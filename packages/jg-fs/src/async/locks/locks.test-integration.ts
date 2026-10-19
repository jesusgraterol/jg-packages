// @vitest-environment node
import { spawnSync } from 'node:child_process';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../../shared/index.js';

import { acquireLock } from './locks.js';

const IS_POSIX = process.platform !== 'win32';

/**
 * Gives the pid of a process that has exited, as a dead owner's.
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
 * Builds an owner.json record.
 * @param pid The owner's pid.
 * @param host The owner's host.
 * @returns The record's JSON text.
 */
const ownerRecord = (pid: number, host: string = hostname()): string =>
  JSON.stringify({ version: 1, pid, nonce: 'earlier-nonce', hostname: host });

describe('acquireLock', () => {
  let directory: string;
  let lockPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'jg-fs-locks-'));
    lockPath = join(directory, 'nightly-report.lock');
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  /**
   * Creates a lock's directory by hand, as an earlier process left it.
   * @param ownerJson The content of owner.json, or `undefined` for none.
   * @param extraEntries The names of the extra files or directories, a name ending in `/` being a
   * directory.
   */
  const createStaleLock = async (
    ownerJson: string | undefined,
    extraEntries: string[] = [],
  ): Promise<void> => {
    await mkdir(lockPath);
    if (ownerJson !== undefined) {
      await writeFile(join(lockPath, 'owner.json'), ownerJson);
    }
    for (const entry of extraEntries) {
      await (entry.endsWith('/')
        ? mkdir(join(lockPath, entry))
        : writeFile(join(lockPath, entry), ''));
    }
  };

  test('creates the lock with an owner.json naming this process, and removes it on release', async () => {
    const lock = await acquireLock(lockPath);
    const record: unknown = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8'));

    expect(lock.path).toBe(lockPath);
    expect(lock.owner).toStrictEqual({
      pid: process.pid,
      nonce: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      hostname: hostname(),
    });
    expect(record).toStrictEqual({ version: 1, ...lock.owner });
    expect(await readdir(lockPath)).toStrictEqual(['owner.json']);

    await lock.release();

    expect(await readdir(directory)).toStrictEqual([]);
  });

  test.skipIf(!IS_POSIX)('lets only its user read the directory and owner.json', async () => {
    const lock = await acquireLock(lockPath);

    expect((await stat(lockPath)).mode & 0o777).toBe(0o700);
    expect((await stat(join(lockPath, 'owner.json'))).mode & 0o777).toBe(0o600);
    await lock.release();
  });

  test('is busy while held, naming the owner', async () => {
    const lock = await acquireLock(lockPath);

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      message: `The lock '${lockPath}' is busy.`,
      data: { path: lockPath, reason: 'held', pid: process.pid, hostname: hostname() },
    });
    await lock.release();
  });

  test('can be acquired again once released', async () => {
    await (await acquireLock(lockPath)).release();
    const lock = await acquireLock(lockPath);

    expect(lock.owner.pid).toBe(process.pid);
    await lock.release();
  });

  test('lets exactly one of many concurrent acquisitions win', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 16 }, () => acquireLock(lockPath)),
    );
    const winners = results.filter((result) => result.status === 'fulfilled');
    const losers = results.filter((result) => result.status === 'rejected');

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(15);
    for (const loser of losers) {
      expect(loser.reason).toMatchObject({ code: ERRORS.LOCK_BUSY });
    }
    await (
      winners[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof acquireLock>>>
    ).value.release();
  });

  test('takes a lock over from an owner on this host whose process is gone', async () => {
    await createStaleLock(ownerRecord(getDeadPid()));

    const lock = await acquireLock(lockPath);
    const record: unknown = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8'));

    expect(record).toStrictEqual({ version: 1, ...lock.owner });
    expect(await readdir(lockPath)).toStrictEqual(['owner.json']);
    await lock.release();
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('stays busy for an owner on another host, even when that pid is gone here', async () => {
    const pid = getDeadPid();
    await createStaleLock(ownerRecord(pid, 'another-host'));

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'other-host', pid, hostname: 'another-host' },
    });
    expect(await readFile(join(lockPath, 'owner.json'), 'utf8')).toBe(
      ownerRecord(pid, 'another-host'),
    );
  });

  test.each([
    ['without owner.json', undefined],
    ['with an owner.json that is not JSON', '{'],
    [
      'with an owner.json of another version',
      JSON.stringify({ version: 2, pid: 1, nonce: 'n', hostname: hostname() }),
    ],
    [
      'with an owner.json missing its nonce',
      JSON.stringify({ version: 1, pid: 1, hostname: hostname() }),
    ],
    ['with an owner.json larger than 4096 bytes', ' '.repeat(4097)],
  ])('stays busy, as ownerless, for a lock %s', async (_, ownerJson) => {
    await createStaleLock(ownerJson);

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { path: lockPath, reason: 'ownerless' },
    });
    expect((await lstat(lockPath)).isDirectory()).toBe(true);
  });

  test('stays busy for a dead owner whose takeover left its recovery claim', async () => {
    await createStaleLock(ownerRecord(getDeadPid()), ['recovery/']);

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'recovery-in-progress' },
    });
    expect((await readdir(lockPath)).sort()).toStrictEqual(['owner.json', 'recovery']);
  });

  test("stays busy for a dead owner whose directory holds an interrupted write's file", async () => {
    await createStaleLock(ownerRecord(getDeadPid()), ['.3f1c9b2e.tmp']);

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'unexpected-entries' },
    });
    expect((await readdir(lockPath)).sort()).toStrictEqual(['.3f1c9b2e.tmp', 'owner.json']);
  });

  test('refuses to release a lock whose owner.json names someone else, and leaves it', async () => {
    const lock = await acquireLock(lockPath);
    const tampered = JSON.stringify({
      version: 1,
      pid: process.pid,
      nonce: 'other',
      hostname: hostname(),
    });
    await writeFile(join(lockPath, 'owner.json'), tampered);

    await expect(lock.release()).rejects.toMatchObject({
      code: ERRORS.LOCK_NOT_OWNED,
      message: `The lock '${lockPath}' is no longer owned by this process.`,
    });
    expect(await readFile(join(lockPath, 'owner.json'), 'utf8')).toBe(tampered);
  });

  test('refuses to release a lock removed by hand', async () => {
    const lock = await acquireLock(lockPath);
    await rm(lockPath, { recursive: true });

    await expect(lock.release()).rejects.toMatchObject({ code: ERRORS.LOCK_NOT_OWNED });
  });

  test('keeps the lock owned when its directory holds anything else, deleting nothing', async () => {
    const lock = await acquireLock(lockPath);
    await writeFile(join(lockPath, 'notes.txt'), 'written by hand');

    await expect(lock.release()).rejects.toMatchObject({
      code: ERRORS.LOCK_RELEASE_FAILED,
      message: `The lock '${lockPath}' could not be released.`,
    });
    expect((await readdir(lockPath)).sort()).toStrictEqual(['notes.txt', 'owner.json']);
    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'held' },
    });

    await rm(join(lockPath, 'notes.txt'));
    await lock.release();
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('does nothing when released again, including while a release is running', async () => {
    const lock = await acquireLock(lockPath);

    await Promise.all([lock.release(), lock.release()]);
    await lock.release();

    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('refuses a path that is a file', async () => {
    await writeFile(lockPath, '');

    await expect(acquireLock(lockPath)).rejects.toMatchObject({ code: ERRORS.NOT_A_DIRECTORY });
  });

  test.skipIf(!IS_POSIX)('refuses a path that is a symbolic link to a directory', async () => {
    const target = join(directory, 'target');
    await mkdir(target);
    await symlink(target, lockPath);

    await expect(acquireLock(lockPath)).rejects.toMatchObject({ code: ERRORS.NOT_A_DIRECTORY });
    expect(await readdir(target)).toStrictEqual([]);
  });

  test('fails to acquire a lock whose parent directory does not exist', async () => {
    const orphan = join(directory, 'missing', 'nightly-report.lock');

    await expect(acquireLock(orphan)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      message: `The lock '${orphan}' could not be acquired.`,
      cause: expect.objectContaining({ code: 'ENOENT' }) as unknown,
    });
  });
});
