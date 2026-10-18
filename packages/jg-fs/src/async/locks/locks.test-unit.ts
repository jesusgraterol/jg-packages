// @vitest-environment node
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../../shared/index.js';

import { acquireLock } from './locks.js';

// keeps the real filesystem, while letting a test make a call fail or do more
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    lstat: vi.fn(actual.lstat),
    mkdir: vi.fn(actual.mkdir),
    open: vi.fn(actual.open),
    readdir: vi.fn(actual.readdir),
    rm: vi.fn(actual.rm),
    rmdir: vi.fn(actual.rmdir),
    writeFile: vi.fn(actual.writeFile),
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

describe('acquireLock failures', () => {
  let actualFs: typeof fs;
  let directory: string;
  let lockPath: string;

  /**
   * Leaves a lock behind whose owner on this host has exited.
   * @param nonce The owner's nonce.
   */
  const createDeadOwnersLock = async (nonce = 'dead-nonce'): Promise<void> => {
    await actualFs.mkdir(lockPath);
    await actualFs.writeFile(
      join(lockPath, 'owner.json'),
      JSON.stringify({ version: 1, pid: getDeadPid(), nonce, hostname: hostname() }),
    );
  };

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs/promises');
  });

  beforeEach(async () => {
    directory = await actualFs.mkdtemp(join(tmpdir(), 'jg-fs-lock-failures-'));
    lockPath = join(directory, 'job.lock');
  });

  afterEach(async () => {
    vi.mocked(fs.lstat).mockReset().mockImplementation(actualFs.lstat);
    vi.mocked(fs.mkdir).mockReset().mockImplementation(actualFs.mkdir);
    vi.mocked(fs.open).mockReset().mockImplementation(actualFs.open);
    vi.mocked(fs.readdir).mockReset().mockImplementation(actualFs.readdir);
    vi.mocked(fs.rm).mockReset().mockImplementation(actualFs.rm);
    vi.mocked(fs.rmdir).mockReset().mockImplementation(actualFs.rmdir);
    vi.mocked(fs.writeFile).mockReset().mockImplementation(actualFs.writeFile);
    await actualFs.rm(directory, { recursive: true, force: true });
  });

  test('removes its directory again when owner.json cannot be written', async () => {
    vi.mocked(fs.writeFile).mockRejectedValueOnce(systemError('ENOSPC'));

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'ENOSPC' }) as unknown,
    });
    expect(await actualFs.readdir(directory)).toStrictEqual([]);
  });

  test('fails when an existing lock cannot be read', async () => {
    await actualFs.mkdir(lockPath);
    vi.mocked(fs.readdir).mockRejectedValueOnce(systemError('EACCES'));

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'EACCES' }) as unknown,
    });
  });

  test('tries again when the lock disappears while it is being inspected', async () => {
    await actualFs.mkdir(lockPath);
    vi.mocked(fs.lstat).mockImplementationOnce(async () => {
      await actualFs.rm(lockPath, { recursive: true });
      throw systemError('ENOENT');
    });

    const lock = await acquireLock(lockPath);

    expect(lock.owner.pid).toBe(process.pid);
    await lock.release();
  });

  test('is busy when the lock keeps disappearing and coming back', async () => {
    vi.mocked(fs.mkdir).mockRejectedValue(systemError('EEXIST'));
    vi.mocked(fs.lstat).mockRejectedValue(systemError('ENOENT'));

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { path: lockPath, reason: 'held' },
    });
  });

  test('fails when the recovery claim cannot be created', async () => {
    await createDeadOwnersLock();
    vi.mocked(fs.mkdir).mockImplementation(async (path, options) => {
      if (String(path).endsWith('recovery')) {
        throw systemError('EACCES');
      }
      return actualFs.mkdir(path, options);
    });

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
    });
  });

  test('is busy when another process claims the takeover first', async () => {
    await createDeadOwnersLock();
    vi.mocked(fs.mkdir).mockImplementation(async (path, options) => {
      if (String(path).endsWith('recovery')) {
        throw systemError('EEXIST');
      }
      return actualFs.mkdir(path, options);
    });

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'recovery-in-progress' },
    });
  });

  test('is busy, and drops its claim, when another process takes the lock over first', async () => {
    await createDeadOwnersLock();
    vi.mocked(fs.mkdir).mockImplementation(async (path, options) => {
      const result = await actualFs.mkdir(path, options);
      if (String(path).endsWith('recovery')) {
        await actualFs.writeFile(
          join(lockPath, 'owner.json'),
          JSON.stringify({ version: 1, pid: process.pid, nonce: 'winner', hostname: hostname() }),
        );
      }
      return result;
    });

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'held', pid: process.pid },
    });
    expect(await actualFs.readdir(lockPath)).toStrictEqual(['owner.json']);
  });

  test('is busy, and drops its claim, when owner.json disappears during the takeover', async () => {
    await createDeadOwnersLock();
    vi.mocked(fs.mkdir).mockImplementation(async (path, options) => {
      const result = await actualFs.mkdir(path, options);
      if (String(path).endsWith('recovery')) {
        await actualFs.rm(join(lockPath, 'owner.json'));
      }
      return result;
    });

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_BUSY,
      data: { reason: 'ownerless' },
    });
    expect(await actualFs.readdir(lockPath)).toStrictEqual([]);
  });

  test("drops its claim, and leaves the dead owner's record, when the new one cannot be written", async () => {
    await createDeadOwnersLock();
    const record = await actualFs.readFile(join(lockPath, 'owner.json'), 'utf8');
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      if (String(path).endsWith('.tmp')) {
        throw systemError('ENOSPC');
      }
      return actualFs.open(path, flags, mode);
    });

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'ENOSPC' }) as unknown,
    });
    expect(await actualFs.readdir(lockPath)).toStrictEqual(['owner.json']);
    expect(await actualFs.readFile(join(lockPath, 'owner.json'), 'utf8')).toBe(record);
  });

  test('fails when its recovery claim cannot be removed after the takeover', async () => {
    await createDeadOwnersLock();
    vi.mocked(fs.rmdir).mockRejectedValueOnce(systemError('EBUSY'));

    await expect(acquireLock(lockPath)).rejects.toMatchObject({
      code: ERRORS.LOCK_ACQUISITION_FAILED,
      cause: expect.objectContaining({ code: 'EBUSY' }) as unknown,
    });
  });
});

describe('release failures', () => {
  let actualFs: typeof fs;
  let directory: string;
  let lockPath: string;

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs/promises');
  });

  beforeEach(async () => {
    directory = await actualFs.mkdtemp(join(tmpdir(), 'jg-fs-release-failures-'));
    lockPath = join(directory, 'job.lock');
  });

  afterEach(async () => {
    vi.mocked(fs.readdir).mockReset().mockImplementation(actualFs.readdir);
    vi.mocked(fs.rm).mockReset().mockImplementation(actualFs.rm);
    vi.mocked(fs.rmdir).mockReset().mockImplementation(actualFs.rmdir);
    vi.mocked(fs.writeFile).mockReset().mockImplementation(actualFs.writeFile);
    await actualFs.rm(directory, { recursive: true, force: true });
  });

  test('writes owner.json back when the directory cannot be removed, so the lock stays owned', async () => {
    const lock = await acquireLock(lockPath);
    vi.mocked(fs.rmdir).mockRejectedValueOnce(systemError('ENOTEMPTY'));

    await expect(lock.release()).rejects.toMatchObject({
      code: ERRORS.LOCK_RELEASE_FAILED,
      cause: expect.objectContaining({ code: 'ENOTEMPTY' }) as unknown,
    });
    expect(JSON.parse(await actualFs.readFile(join(lockPath, 'owner.json'), 'utf8'))).toStrictEqual(
      { version: 1, ...lock.owner },
    );

    await lock.release();
    expect(await actualFs.readdir(directory)).toStrictEqual([]);
  });

  test('fails, keeping owner.json, when the directory cannot be listed', async () => {
    const lock = await acquireLock(lockPath);
    vi.mocked(fs.readdir).mockRejectedValueOnce(systemError('EACCES'));

    await expect(lock.release()).rejects.toMatchObject({ code: ERRORS.LOCK_RELEASE_FAILED });
    expect(await actualFs.readdir(lockPath)).toStrictEqual(['owner.json']);
    await lock.release();
  });

  test('fails, keeping the lock, when owner.json cannot be removed', async () => {
    const lock = await acquireLock(lockPath);
    vi.mocked(fs.rm).mockRejectedValueOnce(systemError('EPERM'));

    await expect(lock.release()).rejects.toMatchObject({ code: ERRORS.LOCK_RELEASE_FAILED });
    expect(await actualFs.readdir(lockPath)).toStrictEqual(['owner.json']);
    await lock.release();
  });
});
