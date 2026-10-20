import { lstatSync, mkdirSync, readdirSync, rmdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getErrorCode, isException } from 'jg-exception';

import {
  assertLockOwnerFits,
  createLockOwner,
  type IAcquireLockOptions,
  type IFileLockOwner,
  isNotFoundError,
  isProcessGone,
  isSameLockOwner,
  judgeExistingLock,
  lockAcquisitionFailed,
  lockBusy,
  lockNotOwned,
  lockReleaseFailed,
  LOCK_OWNER_FILE,
  LOCK_OWNER_MAX_BYTES,
  LOCK_RECOVERY_DIRECTORY,
  notADirectory,
  parseLockOwner,
  serializeLockOwner,
} from '../../shared/index.js';

import { readBoundedFile, writeFileAtomic } from '../files/index.js';

import type { IFileLock } from './types.js';

// how many times acquireLock tries to create a lock that disappears while it's being inspected
const ACQUIRE_ATTEMPTS = 2;

// the modes of a lock's directory and owner.json: only the owner's user can read them
const LOCK_DIRECTORY_MODE = 0o700;
const LOCK_OWNER_FILE_MODE = 0o600;

/**
 * Reads a lock's owner.json, which counts as missing when it can't be read, is too large, or
 * isn't a valid record.
 * @param path The lock's path.
 * @returns The owner, or `undefined`.
 */
const readOwner = (path: string): IFileLockOwner | undefined => {
  try {
    return parseLockOwner(readBoundedFile(join(path, LOCK_OWNER_FILE), LOCK_OWNER_MAX_BYTES));
  } catch {
    return undefined;
  }
};

/**
 * Writes a lock's owner.json, failing when the file already exists.
 * @param path The lock's path.
 * @param owner The owner.
 */
const writeOwner = (path: string, owner: IFileLockOwner): void => {
  writeFileSync(join(path, LOCK_OWNER_FILE), serializeLockOwner(owner), {
    flag: 'wx',
    mode: LOCK_OWNER_FILE_MODE,
  });
};

/**
 * Ignores the error of a cleanup step, whose failure leaves nothing worse than the error being
 * reported.
 * @param step The step.
 */
const tryCleanup = (step: () => void): void => {
  try {
    step();
  } catch {
    // the error being reported matters more
  }
};

/**
 * Creates a lock's directory and its owner.json. When owner.json can't be written, the directory,
 * which is this call's own, is removed again.
 * @param path The lock's path.
 * @param owner The owner.
 * @returns Whether the lock was created, `false` when it exists.
 * @throws
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 */
const createLock = (path: string, owner: IFileLockOwner): boolean => {
  try {
    mkdirSync(path, { mode: LOCK_DIRECTORY_MODE });
  } catch (error) {
    if (getErrorCode(error) === 'EEXIST') {
      return false;
    }
    throw lockAcquisitionFailed(path, error);
  }
  try {
    writeOwner(path, owner);
  } catch (error) {
    tryCleanup(() => rmSync(join(path, LOCK_OWNER_FILE), { force: true }));
    tryCleanup(() => rmdirSync(path));
    throw lockAcquisitionFailed(path, error);
  }
  return true;
};

/**
 * Lists the names in an existing lock's directory.
 * @param path The lock's path.
 * @returns The names, or `undefined` when the lock disappeared.
 * @throws
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 */
const readLockEntries = (path: string): string[] | undefined => {
  try {
    if (!lstatSync(path).isDirectory()) {
      throw notADirectory(path);
    }
    return readdirSync(path);
  } catch (error) {
    if (isException(error)) {
      throw error;
    }
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw lockAcquisitionFailed(path, error);
  }
};

/**
 * Takes a lock over from an owner whose process is gone. The recovery directory claims the
 * takeover, so only one process does it, and the owner is checked again under that claim.
 * @param path The lock's path.
 * @param deadOwner The owner whose process is gone.
 * @param owner The new owner.
 * @throws
 * - LOCK_BUSY: The lock '<path>' is busy.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 */
const recoverLock = (path: string, deadOwner: IFileLockOwner, owner: IFileLockOwner): void => {
  const claimPath = join(path, LOCK_RECOVERY_DIRECTORY);
  try {
    mkdirSync(claimPath);
  } catch (error) {
    throw getErrorCode(error) === 'EEXIST'
      ? lockBusy(path, 'recovery-in-progress', deadOwner)
      : lockAcquisitionFailed(path, error);
  }
  try {
    const current = readOwner(path);
    if (current === undefined) {
      throw lockBusy(path, 'ownerless');
    }
    if (!isSameLockOwner(current, deadOwner) || !isProcessGone(current.pid)) {
      throw lockBusy(path, 'held', current);
    }
    writeFileAtomic(join(path, LOCK_OWNER_FILE), serializeLockOwner(owner), LOCK_OWNER_FILE_MODE);
  } catch (error) {
    tryCleanup(() => rmdirSync(claimPath));
    throw isException(error) ? error : lockAcquisitionFailed(path, error);
  }
  try {
    rmdirSync(claimPath);
  } catch (error) {
    throw lockAcquisitionFailed(path, error);
  }
};

/**
 * Builds the lock a caller holds, whose release removes it only while owner.json still names the
 * caller and the directory holds nothing else.
 * @param path The lock's path.
 * @param owner The caller, as owner.json names it.
 * @returns The lock.
 */
const createFileLock = (path: string, owner: IFileLockOwner): IFileLock => {
  let isReleased = false;

  /**
   * Removes owner.json, then the directory, writing owner.json back when the directory can't be
   * removed, so it never stays without its owner.
   * @throws
   * - LOCK_NOT_OWNED: The lock '<path>' is no longer owned by this process.
   * - LOCK_RELEASE_FAILED: The lock '<path>' could not be released.
   */
  const removeLock = (): void => {
    const current = readOwner(path);
    if (current === undefined || !isSameLockOwner(current, owner)) {
      throw lockNotOwned(path);
    }
    let entries: string[];
    try {
      entries = readdirSync(path);
    } catch (error) {
      throw lockReleaseFailed(path, error);
    }
    if (entries.some((entry) => entry !== LOCK_OWNER_FILE)) {
      throw lockReleaseFailed(path);
    }
    try {
      rmSync(join(path, LOCK_OWNER_FILE));
    } catch (error) {
      throw lockReleaseFailed(path, error);
    }
    try {
      rmdirSync(path);
    } catch (error) {
      tryCleanup(() => writeOwner(path, owner));
      throw lockReleaseFailed(path, error);
    }
  };

  return {
    path,
    owner,
    release: () => {
      if (!isReleased) {
        removeLock();
        isReleased = true;
      }
    },
  };
};

/**
 * Acquires a lock that only one process at a time can hold, such as one guarding a script that
 * mustn't run twice at once. The lock is a directory at `path`, created with mode `0o700`, holding
 * an owner.json, mode `0o600`, that names the process, with the `metadata` it's given, such as the
 * command it runs.
 *
 * A lock that already exists is never taken over by itself, even when its owner's process is gone,
 * because only the caller knows whether that owner left work half done. It fails with `LOCK_BUSY`,
 * whose `data.reason` says why: `held`, `owner-gone`, `other-host`, `ownerless`,
 * `recovery-in-progress`, or `unexpected-entries`. To take over from an owner whose process is
 * gone, read it with `readLockOwner`, check what it left, and pass it as `recoverFrom`: the lock is
 * taken over only from that exact owner, on this host, when its process is gone and the directory
 * holds nothing but owner.json. A lock left behind by a crash at the wrong moment stays busy until
 * it's removed by hand, as the README describes.
 *
 * Use it on local filesystems only. POSIX modes don't apply on Windows, and a lock is never taken
 * over from another host.
 * @param path The lock's directory, whose parent must exist.
 * @param options What to write about the owner, and the dead owner to take the lock over from.
 * @returns The lock, released with `release()`.
 * @example
 * import { acquireLock, readLockOwner, writeFileAtomic } from 'jg-fs/sync';
 *
 * const lock = acquireLock('.locks/nightly-report', { metadata: { command: 'report' } });
 * try {
 *   writeFileAtomic('reports/nightly.json', JSON.stringify({ generatedAt: Date.now() }));
 * } finally {
 *   lock.release();
 * }
 *
 * // after a crash: take the lock over from the owner whose process is gone, once its work is checked
 * const deadOwner = readLockOwner('.locks/nightly-report');
 * if (deadOwner !== null) {
 *   acquireLock('.locks/nightly-report', { recoverFrom: deadOwner });
 * }
 * @throws
 * - LOCK_BUSY: The lock '<path>' is busy.
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 */
export const acquireLock = (
  path: string,
  { metadata, recoverFrom }: IAcquireLockOptions = {},
): IFileLock => {
  const owner = createLockOwner(metadata);
  assertLockOwnerFits(path, owner);
  for (let attempt = 1; attempt <= ACQUIRE_ATTEMPTS; attempt += 1) {
    if (createLock(path, owner)) {
      return createFileLock(path, owner);
    }
    const entries = readLockEntries(path);
    if (entries !== undefined) {
      const current = readOwner(path);
      const judgement = judgeExistingLock(entries, current, recoverFrom);
      if (!judgement.isRecoverable) {
        throw lockBusy(path, judgement.reason, current);
      }
      recoverLock(path, judgement.owner, owner);
      return createFileLock(path, owner);
    }
  }
  // the lock kept disappearing and coming back, so another process is acquiring it
  throw lockBusy(path, 'held');
};

/**
 * Reads who holds a lock, as owner.json names it, such as to show it, or to pass it to
 * `acquireLock`'s `recoverFrom` once its process is gone.
 * @param path The lock's directory.
 * @returns The owner, with its metadata, or null when there's no lock, or its owner.json is
 * missing or invalid, as after a crash while it was being acquired.
 * @example
 * import { readLockOwner } from 'jg-fs/sync';
 *
 * const owner = readLockOwner('.locks/nightly-report');
 * owner?.metadata?.['command']; // what the owner wrote about itself, such as 'report'
 */
export const readLockOwner = (path: string): IFileLockOwner | null => readOwner(path) ?? null;
