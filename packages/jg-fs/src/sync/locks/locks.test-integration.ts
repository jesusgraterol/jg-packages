// @vitest-environment node
import { spawn, spawnSync } from 'node:child_process';
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
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../../shared/index.js';

import { acquireLock, readLockOwner } from './locks.js';

const IS_POSIX = process.platform !== 'win32';

// the package's directory, from which a child process imports the built jg-fs/sync
const PACKAGE_DIRECTORY = fileURLToPath(new URL('../../..', import.meta.url));

// a child process that tries the lock and reports `won` or `busy:<reason>`; when it won, it holds
// the lock until it reads a line, then releases it
const CONTENDER_SCRIPT = `
import { acquireLock } from 'jg-fs/sync';
let lock;
try {
  lock = acquireLock(process.argv[1]);
} catch (error) {
  process.stdout.write('busy:' + (error.data?.reason ?? error.code));
  process.exit(0);
}
process.stdout.write('won');
process.stdin.once('data', () => {
  lock.release();
  process.stdout.write(':released');
  process.exit(0);
});
`;

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

/**
 * Runs a function that must throw, and gives what it threw.
 * @param run The function.
 * @returns The thrown value.
 */
const catchError = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('The function did not throw.');
};

describe('acquireLock (sync)', () => {
  let directory: string;
  let lockPath: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'jg-fs-sync-locks-'));
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
    const lock = acquireLock(lockPath);
    const record: unknown = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8'));

    expect(lock.path).toBe(lockPath);
    expect(lock.owner).toStrictEqual({
      pid: process.pid,
      nonce: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      hostname: hostname(),
    });
    expect(record).toStrictEqual({ version: 1, ...lock.owner });

    lock.release();

    expect(await readdir(directory)).toStrictEqual([]);
  });

  test.skipIf(!IS_POSIX)('lets only its user read the directory and owner.json', async () => {
    const lock = acquireLock(lockPath);

    expect((await stat(lockPath)).mode & 0o777).toBe(0o700);
    expect((await stat(join(lockPath, 'owner.json'))).mode & 0o777).toBe(0o600);
    lock.release();
  });

  test('is busy while held, naming the owner, and can be acquired again once released', () => {
    const lock = acquireLock(lockPath);

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      message: `The lock '${lockPath}' is busy.`,
      data: { path: lockPath, reason: 'held', pid: process.pid, hostname: hostname() },
    });
    lock.release();
    acquireLock(lockPath).release();
  });

  test('lets exactly one of many processes acquiring at once win', async () => {
    const contenders = Array.from({ length: 8 }, () =>
      spawn(process.execPath, ['--input-type=module', '-e', CONTENDER_SCRIPT, lockPath], {
        cwd: PACKAGE_DIRECTORY,
      }),
    );
    // each contender's output, and its exit, once it has reported
    const reports = contenders.map(
      (contender) =>
        new Promise<string>((resolve, reject) => {
          let output = '';
          contender.stdout.on('data', (chunk: Buffer) => {
            output += chunk.toString();
            if (output === 'won') {
              resolve(output);
            }
          });
          contender.on('error', reject);
          contender.on('exit', () => {
            resolve(output);
          });
        }),
    );

    const outcomes = await Promise.all(reports);
    const winnerIndex = outcomes.indexOf('won');

    expect(outcomes.filter((outcome) => outcome === 'won')).toHaveLength(1);
    // a contender that looks between the winner's mkdir and its owner.json sees no owner yet
    for (const outcome of outcomes.filter((_, index) => index !== winnerIndex)) {
      expect(outcome).toMatch(/^busy:(held|ownerless)$/);
    }

    const winner = contenders[winnerIndex];
    const released = new Promise<void>((resolve) => winner?.on('exit', () => resolve()));
    winner?.stdin.write('release\n');
    await released;
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('stays busy, naming the owner, when its process is gone and recoverFrom is missing', async () => {
    const pid = getDeadPid();
    await createStaleLock(ownerRecord(pid));

    let error: unknown;
    try {
      acquireLock(lockPath);
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'owner-gone', pid, hostname: hostname() },
    });
    expect(await readFile(join(lockPath, 'owner.json'), 'utf8')).toBe(ownerRecord(pid));
  });

  test('takes a lock over from the owner recoverFrom names, once its process is gone', async () => {
    await createStaleLock(ownerRecord(getDeadPid()));
    const deadOwner = readLockOwner(lockPath);

    const lock = acquireLock(lockPath, { recoverFrom: deadOwner ?? undefined });
    const record: unknown = JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8'));

    expect(deadOwner).toMatchObject({ nonce: 'earlier-nonce', hostname: hostname() });
    expect(record).toStrictEqual({ version: 1, ...lock.owner });
    expect(await readdir(lockPath)).toStrictEqual(['owner.json']);
    lock.release();
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('writes the metadata it is given, which readLockOwner returns', () => {
    const lock = acquireLock(lockPath, { metadata: { command: 'report', runId: '42' } });

    expect(readLockOwner(lockPath)).toStrictEqual(lock.owner);
    expect(lock.owner.metadata).toStrictEqual({ command: 'report', runId: '42' });
    lock.release();
    expect(readLockOwner(lockPath)).toBeNull();
  });

  test('refuses metadata that is not all strings, or does not fit owner.json', async () => {
    for (const metadata of [
      { count: 1 } as unknown as Record<string, string>,
      { note: 'x'.repeat(5_000) },
    ]) {
      expect(() => acquireLock(lockPath, { metadata })).toThrow(
        expect.objectContaining({ code: ERRORS.LOCK_ACQUISITION_FAILED }) as Error,
      );
    }
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('reads no owner for a lock without a valid owner.json', async () => {
    await mkdir(lockPath);

    expect(readLockOwner(lockPath)).toBeNull();
  });

  test('stays busy for an owner on another host, even when that pid is gone here', async () => {
    const pid = getDeadPid();
    await createStaleLock(ownerRecord(pid, 'another-host'));

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'other-host', pid, hostname: 'another-host' },
    });
  });

  test.each([
    ['without owner.json', undefined],
    ['with an owner.json that is not JSON', '{'],
    ['with an owner.json larger than 4096 bytes', ' '.repeat(4097)],
  ])('stays busy, as ownerless, for a lock %s', async (_, ownerJson) => {
    await createStaleLock(ownerJson);

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { path: lockPath, reason: 'ownerless' },
    });
    expect((await lstat(lockPath)).isDirectory()).toBe(true);
  });

  test('stays busy for a dead owner whose takeover left its recovery claim', async () => {
    await createStaleLock(ownerRecord(getDeadPid()), ['recovery/']);

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'recovery-in-progress' },
    });
  });

  test("stays busy for a dead owner whose directory holds an interrupted write's file", async () => {
    await createStaleLock(ownerRecord(getDeadPid()), ['.3f1c9b2e.tmp']);

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'unexpected-entries' },
    });
  });

  test('refuses to release a lock whose owner.json names someone else, and leaves it', async () => {
    const lock = acquireLock(lockPath);
    const tampered = JSON.stringify({
      version: 1,
      pid: process.pid,
      nonce: 'other',
      hostname: hostname(),
    });
    await writeFile(join(lockPath, 'owner.json'), tampered);

    expect(catchError(() => lock.release())).toMatchObject({
      code: ERRORS.LOCK_NOT_OWNED,
      message: `The lock '${lockPath}' is no longer owned by this process.`,
    });
    expect(await readFile(join(lockPath, 'owner.json'), 'utf8')).toBe(tampered);
  });

  test('keeps the lock owned when its directory holds anything else, deleting nothing', async () => {
    const lock = acquireLock(lockPath);
    await writeFile(join(lockPath, 'notes.txt'), 'written by hand');

    expect(catchError(() => lock.release())).toMatchObject({
      code: ERRORS.LOCK_RELEASE_FAILED,
      message: `The lock '${lockPath}' could not be released.`,
    });
    expect((await readdir(lockPath)).sort()).toStrictEqual(['notes.txt', 'owner.json']);

    await rm(join(lockPath, 'notes.txt'));
    lock.release();
    lock.release();
    expect(await readdir(directory)).toStrictEqual([]);
  });

  test('refuses a path that is a file', async () => {
    await writeFile(lockPath, '');

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.NOT_A_DIRECTORY,
    });
  });

  test.skipIf(!IS_POSIX)('refuses a path that is a symbolic link to a directory', async () => {
    const target = join(directory, 'target');
    await mkdir(target);
    await symlink(target, lockPath);

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.NOT_A_DIRECTORY,
    });
    expect(await readdir(target)).toStrictEqual([]);
  });

  test('fails to acquire a lock whose parent directory does not exist', () => {
    const orphan = join(directory, 'missing', 'nightly-report.lock');

    expect(catchError(() => acquireLock(orphan))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      message: `The lock '${orphan}' could not be acquired.`,
      cause: expect.objectContaining({ code: 'ENOENT' }) as unknown,
    });
  });
});
