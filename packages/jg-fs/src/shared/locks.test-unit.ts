// @vitest-environment node
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { describe, expect, test } from 'vitest';

import {
  createLockOwner,
  isProcessGone,
  isSameLockOwner,
  judgeExistingLock,
  parseLockOwner,
  serializeLockOwner,
} from './locks.js';

/**
 * Gives the pid of a process that has exited.
 * @returns The pid.
 */
const getDeadPid = (): number => {
  const { pid } = spawnSync(process.execPath, ['-e', '']);
  if (pid === undefined) {
    throw new Error('The child process did not start.');
  }
  return pid;
};

/**
 * Encodes an owner.json record.
 * @param record The record.
 * @returns The file's content.
 */
const encode = (record: unknown): Buffer => Buffer.from(JSON.stringify(record));

describe('the owner record', () => {
  test('names this process with a nonce of its own, and reads back what it writes', () => {
    const owner = createLockOwner();

    expect(owner).toStrictEqual({
      pid: process.pid,
      nonce: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      hostname: hostname(),
    });
    expect(createLockOwner().nonce).not.toBe(owner.nonce);
    expect(JSON.parse(serializeLockOwner(owner))).toStrictEqual({ version: 1, ...owner });
    expect(parseLockOwner(Buffer.from(serializeLockOwner(owner)))).toStrictEqual(owner);
  });

  test.each([
    ['missing content', undefined],
    ['text that is not JSON', Buffer.from('{')],
    ['JSON that is not an object', encode([1])],
    ['null', encode(null)],
    ['another version', encode({ version: 2, pid: 1, nonce: 'n', hostname: 'h' })],
    ['a pid of zero', encode({ version: 1, pid: 0, nonce: 'n', hostname: 'h' })],
    ['a negative pid', encode({ version: 1, pid: -1, nonce: 'n', hostname: 'h' })],
    ['a fractional pid', encode({ version: 1, pid: 1.5, nonce: 'n', hostname: 'h' })],
    ['a string pid', encode({ version: 1, pid: '1', nonce: 'n', hostname: 'h' })],
    ['an empty nonce', encode({ version: 1, pid: 1, nonce: '', hostname: 'h' })],
    ['no hostname', encode({ version: 1, pid: 1, nonce: 'n' })],
    ['an empty hostname', encode({ version: 1, pid: 1, nonce: 'n', hostname: '' })],
  ])('rejects %s', (_, content) => {
    expect(parseLockOwner(content)).toBeUndefined();
  });

  test('tells acquisitions apart by pid and nonce', () => {
    const owner = { pid: 1, nonce: 'n', hostname: 'h' };

    expect(isSameLockOwner(owner, { ...owner, hostname: 'other' })).toBe(true);
    expect(isSameLockOwner(owner, { ...owner, nonce: 'm' })).toBe(false);
    expect(isSameLockOwner(owner, { ...owner, pid: 2 })).toBe(false);
  });
});

describe('isProcessGone', () => {
  test('knows a running process from one that has exited', () => {
    expect(isProcessGone(process.pid)).toBe(false);
    expect(isProcessGone(getDeadPid())).toBe(true);
  });
});

describe('judgeExistingLock', () => {
  const alive = { pid: process.pid, nonce: 'n', hostname: hostname() };
  const dead = { pid: getDeadPid(), nonce: 'n', hostname: hostname() };

  test.each([
    [
      'a recovery claim, before anything else',
      ['owner.json', 'recovery'],
      dead,
      'recovery-in-progress',
    ],
    ['no owner', [], undefined, 'ownerless'],
    [
      'an owner on another host',
      ['owner.json'],
      { ...dead, hostname: 'another-host' },
      'other-host',
    ],
    ['a live owner, even with other entries', ['owner.json', 'notes.txt'], alive, 'held'],
    ['a dead owner with other entries', ['owner.json', '.a.tmp'], dead, 'unexpected-entries'],
  ])('is busy for %s', (_, entries, owner, reason) => {
    expect(judgeExistingLock(entries, owner)).toStrictEqual({ isRecoverable: false, reason });
  });

  test('takes over from a dead owner on this host when only owner.json remains', () => {
    expect(judgeExistingLock(['owner.json'], dead)).toStrictEqual({
      isRecoverable: true,
      owner: dead,
    });
  });
});
