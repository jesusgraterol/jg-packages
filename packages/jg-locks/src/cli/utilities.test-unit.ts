// @vitest-environment node
import { Exception } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { describe, expect, test } from 'vitest';

import { ERRORS, type ILockState } from '../locks/index.js';

import { USAGE_ERROR_CODE } from './constants.js';
import {
  describeBusyLock,
  describeHolder,
  describeRecoveryRefusal,
  formatDuration,
  formatLockState,
  isUsageError,
  parseWait,
  toSignalExitCode,
  toStatusRecord,
  usageError,
} from './utilities.js';

const NOW = Date.parse('2026-10-29T12:03:12.000Z');

const HELD: ILockState = {
  name: 'acme.app.port-3000',
  state: 'held',
  owner: {
    pid: 4242,
    nonce: 'nonce-1',
    hostname: 'laptop',
    program: 'dev.js',
    cwd: '/srv/app',
    startedAt: '2026-10-29T12:00:00.000Z',
    metadata: {},
  },
  isOwnerAlive: true,
};

const GONE: ILockState = { ...HELD, state: 'owner-gone', isOwnerAlive: false };

const OWNERLESS: ILockState = {
  name: 'acme.app.new',
  state: 'ownerless',
  owner: null,
  isOwnerAlive: null,
};

describe('parseWait', () => {
  test.each([
    [undefined, 0],
    ['0', 0],
    ['5', 5],
    ['1.5', 1.5],
    ['forever', Infinity],
  ])('parseWait(%s) -> %s', (value, expected) => {
    expect(parseWait(value)).toBe(expected);
  });

  test.each([['-1'], ['soon'], ['1e3'], ['5s'], ['Infinity']])(
    'throws a usage error for %s',
    (value) => {
      expectToThrowCode(() => parseWait(value), USAGE_ERROR_CODE);
    },
  );
});

describe('isUsageError', () => {
  test('recognizes usage, argument, and lock-name errors only', () => {
    expect(isUsageError(usageError('x'))).toBe(true);
    expect(isUsageError(new Exception('x', { code: PROCESS_ERRORS.INVALID_ARGUMENTS }))).toBe(true);
    expect(isUsageError(new Exception('x', { code: ERRORS.LOCK_NAME_INVALID }))).toBe(true);
    expect(isUsageError(new Exception('x', { code: ERRORS.LOCK_ROOT_INVALID }))).toBe(false);
    expect(isUsageError(new Error('x'))).toBe(false);
  });
});

describe('toSignalExitCode', () => {
  test('adds the signal number to 128, as a shell does', () => {
    expect(toSignalExitCode('SIGINT')).toBe(130);
    expect(toSignalExitCode('SIGTERM')).toBe(143);
  });
});

describe('formatDuration', { tags: ['full'] }, () => {
  test.each([
    [0, '0s'],
    [12_400, '12s'],
    [192_000, '3m 12s'],
    [3_600_000, '1h'],
    [7_380_000, '2h 3m'],
    [190_800_000, '2d 5h'],
  ])('formatDuration(%d) -> %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe('describeHolder', () => {
  test('names the program, pid, host, folder, and how long it has held the lock', () => {
    expect(describeHolder(HELD, NOW)).toBe('dev.js (pid 4242) on laptop in /srv/app, for 3m 12s');
  });

  test('leaves out what owner.json does not say', () => {
    const owner = { ...HELD.owner!, program: null, cwd: null, startedAt: null };
    expect(describeHolder({ ...HELD, owner }, NOW)).toBe('an unknown program (pid 4242) on laptop');
    expect(describeHolder({ ...HELD, owner: { ...owner, startedAt: 'not a date' } }, NOW)).toBe(
      'an unknown program (pid 4242) on laptop',
    );
    expect(describeHolder(OWNERLESS, NOW)).toBe('no process: its owner.json is missing or invalid');
  });
});

describe('describeBusyLock', () => {
  test('explains a held lock', () => {
    expect(describeBusyLock(HELD, NOW)).toBe(
      "The lock 'acme.app.port-3000' is held: dev.js (pid 4242) on laptop in /srv/app, for 3m 12s.",
    );
  });

  test('gives the full recover command for a dead holder', () => {
    expect(describeBusyLock(GONE, NOW)).toBe(
      "The lock 'acme.app.port-3000' is owner-gone: dev.js (pid 4242) on laptop in /srv/app, for 3m 12s.\n" +
        'Its holder is gone. Check what it left, then run: jg-locks recover acme.app.port-3000 --nonce nonce-1',
    );
  });
});

describe('formatLockState', () => {
  test('shows the holder, whether it is alive, and its nonce', () => {
    expect(formatLockState(HELD, NOW)).toBe(
      'acme.app.port-3000: held\n' +
        '  holder: dev.js (pid 4242) on laptop in /srv/app, for 3m 12s (alive)\n' +
        '  nonce: nonce-1',
    );
    expect(formatLockState(GONE, NOW)).toContain('(not running)');
    expect(formatLockState({ ...HELD, state: 'other-host', isOwnerAlive: null }, NOW)).toContain(
      '(unknown)',
    );
    expect(formatLockState(OWNERLESS, NOW)).toBe(
      'acme.app.new: ownerless\n  holder: no process: its owner.json is missing or invalid',
    );
  });
});

describe('toStatusRecord', () => {
  test('gives the state, liveness, owner, and whole seconds held', () => {
    expect(toStatusRecord(HELD, NOW)).toStrictEqual({
      name: 'acme.app.port-3000',
      state: 'held',
      isOwnerAlive: true,
      heldSeconds: 192,
      owner: HELD.owner,
    });
    expect(toStatusRecord(OWNERLESS, NOW).heldSeconds).toBeNull();
  });
});

describe('describeRecoveryRefusal', () => {
  test('allows only the dead holder with the named nonce', () => {
    expect(describeRecoveryRefusal(GONE, 'nonce-1')).toBeNull();
    expect(describeRecoveryRefusal(GONE, 'nonce-2')).toBe(
      "The lock 'acme.app.port-3000' is held by nonce nonce-1, not nonce-2. Run jg-locks status to see it.",
    );
    expect(describeRecoveryRefusal(HELD, 'nonce-1')).toBe(
      "The lock 'acme.app.port-3000' is held; jg-locks recover only takes a lock over from a holder whose process is gone.",
    );
    expect(describeRecoveryRefusal({ ...OWNERLESS, state: 'free' }, 'nonce-1')).toBe(
      "The lock 'acme.app.new' is free; there's nothing to recover.",
    );
    expect(describeRecoveryRefusal(OWNERLESS, 'nonce-1')).toContain('is ownerless');
  });
});
