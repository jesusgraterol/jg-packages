import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { Exception, getErrorCode } from 'jg-exception';

import { ERRORS } from './errors.js';
import type { IFileLockOwner, ILockBusyReason, ILockJudgement } from './types.js';

/*
 * The lock protocol both entries share. A lock is a directory created with a non-recursive mkdir,
 * which only one process can win, holding an owner.json that names its owner. These helpers read
 * and judge a lock's state, so the async and sync acquireLock decide identically.
 */

// the file in a lock's directory that names its owner
export const LOCK_OWNER_FILE = 'owner.json';

// the directory a process creates inside a lock while it takes the lock over from a dead owner
export const LOCK_RECOVERY_DIRECTORY = 'recovery';

// the largest owner.json read, in bytes; a valid one is far smaller
export const LOCK_OWNER_MAX_BYTES = 4096;

// the version of owner.json's format
const LOCK_OWNER_VERSION = 1;

/**
 * Names the calling process as a lock's owner, with a nonce of its own.
 * @param metadata What the owner writes about itself, if anything.
 * @returns The owner.
 */
export const createLockOwner = (metadata?: Record<string, string>): IFileLockOwner => ({
  pid: process.pid,
  nonce: randomUUID(),
  hostname: hostname(),
  ...(metadata === undefined ? {} : { metadata: { ...metadata } }),
});

/**
 * Writes an owner as the content of owner.json.
 * @param owner The owner.
 * @returns The JSON text.
 */
export const serializeLockOwner = (owner: IFileLockOwner): string =>
  JSON.stringify({
    version: LOCK_OWNER_VERSION,
    pid: owner.pid,
    nonce: owner.nonce,
    hostname: owner.hostname,
    ...(owner.metadata === undefined ? {} : { metadata: owner.metadata }),
  });

/**
 * Checks that an owner's metadata holds only strings, and that the owner fits owner.json.
 * @param path The lock's path, for the error.
 * @param owner The owner.
 * @throws
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 */
export const assertLockOwnerFits = (path: string, owner: IFileLockOwner): void => {
  const { metadata } = owner;
  const isMetadataValid =
    metadata === undefined ||
    (typeof metadata === 'object' &&
      metadata !== null &&
      !Array.isArray(metadata) &&
      Object.values(metadata).every((value) => typeof value === 'string'));
  if (
    !isMetadataValid ||
    Buffer.byteLength(serializeLockOwner(owner), 'utf8') > LOCK_OWNER_MAX_BYTES
  ) {
    throw new Exception(
      `The lock '${path}' could not be acquired: its metadata must hold only strings and fit owner.json's ${LOCK_OWNER_MAX_BYTES} bytes.`,
      { code: ERRORS.LOCK_ACQUISITION_FAILED, data: { path } },
    );
  }
};

/**
 * Reads owner.json's content, accepting only a complete record of the current version.
 * @param content The file's content, or `undefined` when it couldn't be read.
 * @returns The owner, or `undefined` when the content isn't a valid record.
 */
export const parseLockOwner = (content: Buffer | undefined): IFileLockOwner | undefined => {
  let record: unknown;
  try {
    record = content === undefined ? undefined : JSON.parse(content.toString('utf8'));
  } catch {
    return undefined;
  }
  if (typeof record !== 'object' || record === null) {
    return undefined;
  }
  const { version, pid, nonce, hostname: host, metadata } = record as Record<string, unknown>;
  const isMetadataValid =
    metadata === undefined ||
    (typeof metadata === 'object' &&
      metadata !== null &&
      !Array.isArray(metadata) &&
      Object.values(metadata).every((value) => typeof value === 'string'));
  const isValid =
    version === LOCK_OWNER_VERSION &&
    typeof pid === 'number' &&
    Number.isSafeInteger(pid) &&
    pid > 0 &&
    typeof nonce === 'string' &&
    nonce.length > 0 &&
    typeof host === 'string' &&
    host.length > 0 &&
    isMetadataValid;
  if (!isValid) {
    return undefined;
  }
  return metadata === undefined
    ? { pid, nonce, hostname: host }
    : { pid, nonce, hostname: host, metadata: metadata as Record<string, string> };
};

/**
 * Checks whether two owners are the same acquisition: the same process id and nonce.
 * @param first One owner.
 * @param second The other.
 * @returns Whether they're the same.
 */
export const isSameLockOwner = (first: IFileLockOwner, second: IFileLockOwner): boolean =>
  first.pid === second.pid && first.nonce === second.nonce;

/**
 * Checks whether a process no longer exists, with signal 0, which sends nothing. Only `ESRCH`
 * means it's gone: a process that can't be signalled, such as another user's, counts as alive.
 * @param pid The process id, a positive integer.
 * @returns Whether the process is gone.
 */
export const isProcessGone = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    return getErrorCode(error) === 'ESRCH';
  }
};

/**
 * Judges a lock that already exists: why it's busy, or that it can be taken over, which needs a
 * valid owner on this host whose process is gone, nothing in the directory but owner.json, and
 * the caller naming that exact owner in recoverFrom, so a dead owner is never taken over by
 * accident.
 * @param entries The names in the lock's directory.
 * @param owner Its owner.json's record, or `undefined` when missing or invalid.
 * @param recoverFrom The owner the caller asked to take the lock over from, if any.
 * @returns Why it's busy, or the dead owner it can be taken over from.
 */
export const judgeExistingLock = (
  entries: readonly string[],
  owner: IFileLockOwner | undefined,
  recoverFrom?: IFileLockOwner,
): ILockJudgement => {
  const busy = (reason: ILockBusyReason): ILockJudgement => ({ isRecoverable: false, reason });
  if (entries.includes(LOCK_RECOVERY_DIRECTORY)) {
    return busy('recovery-in-progress');
  }
  if (owner === undefined) {
    return busy('ownerless');
  }
  if (owner.hostname !== hostname()) {
    return busy('other-host');
  }
  if (!isProcessGone(owner.pid)) {
    return busy('held');
  }
  if (!entries.every((entry) => entry === LOCK_OWNER_FILE)) {
    return busy('unexpected-entries');
  }
  return recoverFrom !== undefined &&
    isSameLockOwner(owner, recoverFrom) &&
    owner.hostname === recoverFrom.hostname
    ? { isRecoverable: true, owner }
    : busy('owner-gone');
};

/**
 * Builds the exception for a lock that can't be acquired.
 * @param path The lock's path.
 * @param reason Why it's busy.
 * @param owner Its owner, when owner.json names one.
 * @returns The LOCK_BUSY exception.
 */
export const lockBusy = (
  path: string,
  reason: ILockBusyReason,
  owner?: IFileLockOwner,
): Exception =>
  new Exception(`The lock '${path}' is busy.`, {
    code: ERRORS.LOCK_BUSY,
    data:
      owner === undefined
        ? { path, reason }
        : { path, reason, pid: owner.pid, hostname: owner.hostname },
  });

/**
 * Builds the exception for a lock whose owner.json no longer names the caller.
 * @param path The lock's path.
 * @returns The LOCK_NOT_OWNED exception.
 */
export const lockNotOwned = (path: string): Exception =>
  new Exception(`The lock '${path}' is no longer owned by this process.`, {
    code: ERRORS.LOCK_NOT_OWNED,
    data: { path },
  });

/**
 * Builds the exception for a lock that couldn't be removed, which stays owned.
 * @param path The lock's path.
 * @param cause The error underneath, when there is one.
 * @returns The LOCK_RELEASE_FAILED exception.
 */
export const lockReleaseFailed = (path: string, cause?: unknown): Exception =>
  new Exception(`The lock '${path}' could not be released.`, {
    code: ERRORS.LOCK_RELEASE_FAILED,
    data: { path },
    cause,
  });

/**
 * Builds the exception for a lock that couldn't be created or taken over.
 * @param path The lock's path.
 * @param cause The error underneath.
 * @returns The LOCK_ACQUISITION_FAILED exception.
 */
export const lockAcquisitionFailed = (path: string, cause: unknown): Exception =>
  new Exception(`The lock '${path}' could not be acquired.`, {
    code: ERRORS.LOCK_ACQUISITION_FAILED,
    data: { path },
    cause,
  });
