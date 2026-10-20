// @vitest-environment node
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS, type IFileLockOwner } from '../../shared/index.js';

import { acquireLock } from './locks.js';

// keeps the real filesystem, while letting a test make a call fail or do more
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    lstatSync: vi.fn(actual.lstatSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    openSync: vi.fn(actual.openSync),
    readdirSync: vi.fn(actual.readdirSync),
    rmSync: vi.fn(actual.rmSync),
    rmdirSync: vi.fn(actual.rmdirSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

/**
 * Builds an error with a system error code.
 * @param code The code, such as `EACCES`.
 * @returns The error.
 */
const systemError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`${code}: simulated failure`), { code });

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

describe('acquireLock (sync) failures', () => {
  let actualFs: typeof fs;
  let directory: string;
  let lockPath: string;

  /**
   * Leaves a lock behind whose owner on this host has exited.
   */
  const createDeadOwnersLock = (): IFileLockOwner => {
    const owner = { pid: getDeadPid(), nonce: 'dead-nonce', hostname: hostname() };
    actualFs.mkdirSync(lockPath);
    actualFs.writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ version: 1, ...owner }));
    return owner;
  };

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs');
  });

  beforeEach(() => {
    directory = actualFs.mkdtempSync(join(tmpdir(), 'jg-fs-sync-lock-failures-'));
    lockPath = join(directory, 'job.lock');
  });

  afterEach(() => {
    vi.mocked(fs.lstatSync).mockReset().mockImplementation(actualFs.lstatSync);
    vi.mocked(fs.mkdirSync).mockReset().mockImplementation(actualFs.mkdirSync);
    vi.mocked(fs.openSync).mockReset().mockImplementation(actualFs.openSync);
    vi.mocked(fs.readdirSync).mockReset().mockImplementation(actualFs.readdirSync);
    vi.mocked(fs.rmSync).mockReset().mockImplementation(actualFs.rmSync);
    vi.mocked(fs.rmdirSync).mockReset().mockImplementation(actualFs.rmdirSync);
    vi.mocked(fs.writeFileSync).mockReset().mockImplementation(actualFs.writeFileSync);
    actualFs.rmSync(directory, { recursive: true, force: true });
  });

  test('removes its directory again when owner.json cannot be written', () => {
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw systemError('ENOSPC');
    });

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'ENOSPC' }) as unknown,
    });
    expect(actualFs.readdirSync(directory)).toStrictEqual([]);
  });

  test('fails when an existing lock cannot be read', () => {
    actualFs.mkdirSync(lockPath);
    vi.mocked(fs.readdirSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
    });
  });

  test('tries again when the lock disappears while it is being inspected', () => {
    actualFs.mkdirSync(lockPath);
    vi.mocked(fs.lstatSync).mockImplementationOnce(() => {
      actualFs.rmSync(lockPath, { recursive: true });
      throw systemError('ENOENT');
    });

    const lock = acquireLock(lockPath);

    expect(lock.owner.pid).toBe(process.pid);
    lock.release();
  });

  test('is busy when the lock keeps disappearing and coming back', () => {
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw systemError('EEXIST');
    });
    vi.mocked(fs.lstatSync).mockImplementation(() => {
      throw systemError('ENOENT');
    });

    expect(catchError(() => acquireLock(lockPath))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { path: lockPath, reason: 'held' },
    });
  });

  test('fails when the recovery claim cannot be created', () => {
    const deadOwner = createDeadOwnersLock();
    vi.mocked(fs.mkdirSync).mockImplementation((path, options) => {
      if (String(path).endsWith('recovery')) {
        throw systemError('EACCES');
      }
      return actualFs.mkdirSync(path, options);
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
    });
  });

  test('is busy when another process claims the takeover first', () => {
    const deadOwner = createDeadOwnersLock();
    vi.mocked(fs.mkdirSync).mockImplementation((path, options) => {
      if (String(path).endsWith('recovery')) {
        throw systemError('EEXIST');
      }
      return actualFs.mkdirSync(path, options);
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'recovery-in-progress' },
    });
  });

  test('is busy, and drops its claim, when another process takes the lock over first', () => {
    const deadOwner = createDeadOwnersLock();
    vi.mocked(fs.mkdirSync).mockImplementation((path, options) => {
      const result = actualFs.mkdirSync(path, options);
      if (String(path).endsWith('recovery')) {
        actualFs.writeFileSync(
          join(lockPath, 'owner.json'),
          JSON.stringify({ version: 1, pid: process.pid, nonce: 'winner', hostname: hostname() }),
        );
      }
      return result;
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'held', pid: process.pid },
    });
    expect(actualFs.readdirSync(lockPath)).toStrictEqual(['owner.json']);
  });

  test('is busy, and drops its claim, when owner.json disappears during the takeover', () => {
    const deadOwner = createDeadOwnersLock();
    vi.mocked(fs.mkdirSync).mockImplementation((path, options) => {
      const result = actualFs.mkdirSync(path, options);
      if (String(path).endsWith('recovery')) {
        actualFs.rmSync(join(lockPath, 'owner.json'));
      }
      return result;
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'ownerless' },
    });
    expect(actualFs.readdirSync(lockPath)).toStrictEqual([]);
  });

  test("drops its claim, and leaves the dead owner's record, when the new one cannot be written", () => {
    const deadOwner = createDeadOwnersLock();
    const record = actualFs.readFileSync(join(lockPath, 'owner.json'), 'utf8');
    vi.mocked(fs.openSync).mockImplementation((path, flags, mode) => {
      if (String(path).endsWith('.tmp')) {
        throw systemError('ENOSPC');
      }
      return actualFs.openSync(path, flags, mode);
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'ENOSPC' }) as unknown,
    });
    expect(actualFs.readdirSync(lockPath)).toStrictEqual(['owner.json']);
    expect(actualFs.readFileSync(join(lockPath, 'owner.json'), 'utf8')).toBe(record);
  });

  test('fails when its recovery claim cannot be removed after the takeover', () => {
    const deadOwner = createDeadOwnersLock();
    vi.mocked(fs.rmdirSync).mockImplementationOnce(() => {
      throw systemError('EBUSY');
    });

    expect(catchError(() => acquireLock(lockPath, { recoverFrom: deadOwner }))).toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'EBUSY' }) as unknown,
    });
  });

  test('writes owner.json back when the directory cannot be removed, so the lock stays owned', () => {
    const lock = acquireLock(lockPath);
    vi.mocked(fs.rmdirSync).mockImplementationOnce(() => {
      throw systemError('ENOTEMPTY');
    });

    expect(catchError(() => lock.release())).toMatchObject({
      code: ERRORS.LOCK_RELEASE_FAILED,
      cause: expect.objectContaining({ code: 'ENOTEMPTY' }) as unknown,
    });
    expect(JSON.parse(actualFs.readFileSync(join(lockPath, 'owner.json'), 'utf8'))).toStrictEqual({
      version: 1,
      ...lock.owner,
    });

    lock.release();
    expect(actualFs.readdirSync(directory)).toStrictEqual([]);
  });

  test('fails, keeping the lock, when its directory cannot be listed or owner.json removed', () => {
    const lock = acquireLock(lockPath);
    vi.mocked(fs.readdirSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });
    expect(catchError(() => lock.release())).toMatchObject({ code: ERRORS.LOCK_RELEASE_FAILED });

    vi.mocked(fs.rmSync).mockImplementationOnce(() => {
      throw systemError('EPERM');
    });
    expect(catchError(() => lock.release())).toMatchObject({ code: ERRORS.LOCK_RELEASE_FAILED });

    expect(actualFs.readdirSync(lockPath)).toStrictEqual(['owner.json']);
    lock.release();
  });
});
