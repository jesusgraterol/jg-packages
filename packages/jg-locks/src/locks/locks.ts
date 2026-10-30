import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { Exception, getErrorCode } from 'jg-exception';
import {
  acquireLock as acquireFileLock,
  createPrivateDirectory,
  ERRORS as FS_ERRORS,
  type IFileLock,
  pathExists,
  readLockOwner,
} from 'jg-fs';
import { isProcessRunning } from 'jg-process';

import { MAX_LISTED_LOCKS, POLL_INTERVAL_MS } from './constants.js';
import type {
  IAcquireLockOptions,
  ILock,
  ILockList,
  ILocksRootOptions,
  ILockState,
} from './types.js';
import {
  assertLockName,
  assertLocksRoot,
  assertWaitSeconds,
  buildOwnerMetadata,
  isLockName,
  judgeLock,
  readLockBusy,
  readProgramName,
  resolveLocksRoot,
  shouldKeepWaiting,
  toFileLockOwner,
  toLockOwner,
} from './utilities.js';

/**
 * Resolves the folder that holds every lock on this machine: the `JG_LOCKS_ROOT` environment
 * variable when it's set, which must be an absolute path, otherwise `jg-locks` in the operating
 * system's state folder: `$XDG_STATE_HOME/jg-locks`, or `~/.local/state/jg-locks`, on Linux and
 * macOS, and `%LOCALAPPDATA%\jg-locks` on Windows. Nothing is created until a lock is taken.
 * @returns The folder's absolute path.
 * @example
 * import { getLocksRoot } from 'jg-locks';
 *
 * getLocksRoot(); // such as '/home/ada/.local/state/jg-locks'
 * @throws
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 */
export const getLocksRoot = (): string =>
  resolveLocksRoot(process.env, process.platform, homedir());

/**
 * Resolves the locks folder a call uses: the one it names, or the default.
 * @param root The folder the caller named, if any.
 * @returns The folder's absolute path.
 * @throws
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 */
const resolveRoot = (root: string | undefined): string => {
  if (root === undefined) {
    return getLocksRoot();
  }
  assertLocksRoot(root, process.platform);
  return root;
};

/**
 * Waits before the next attempt, rejecting with the signal's reason when it aborts.
 * @param ms The milliseconds to wait.
 * @param signal The caller's signal, if any.
 * @returns A promise that resolves once the time has passed.
 */
const pause = async (ms: number, signal: AbortSignal | undefined): Promise<void> => {
  try {
    await delay(ms, undefined, signal === undefined ? undefined : { signal });
  } catch (error) {
    signal?.throwIfAborted();
    throw error;
  }
};

/**
 * Builds the lock a caller holds from jg-fs's.
 * @param name The lock's name.
 * @param fileLock jg-fs's lock.
 * @returns The lock.
 */
const toLock = (name: string, fileLock: IFileLock): ILock => ({
  name,
  owner: toLockOwner(fileLock.owner),
  release: () => fileLock.release(),
});

/**
 * Reads a lock's state without taking it: free, held by a live owner on this host, or why it can't
 * be taken, with its owner as owner.json names it.
 * @param name The lock's name.
 * @param options The locks folder.
 * @returns A promise that resolves to the lock's state.
 * @example
 * import { inspectLock } from 'jg-locks';
 *
 * const { state, owner } = await inspectLock('acme.app.port-3000');
 * if (state === 'held') {
 *   console.log(`${owner?.program} (pid ${owner?.pid}) holds the port`);
 * }
 * @throws
 * - LOCK_NAME_INVALID: The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 */
export const inspectLock = async (
  name: string,
  { root }: ILocksRootOptions = {},
): Promise<ILockState> => {
  assertLockName(name);
  const path = join(resolveRoot(root), name);
  const free: ILockState = { name, state: 'free', owner: null, isOwnerAlive: null };
  let entries: string[];
  try {
    entries = await readdir(path);
  } catch (error) {
    const code = getErrorCode(error);
    if (code === 'ENOENT') {
      return free;
    }
    if (code === 'ENOTDIR') {
      throw new Exception(`The path '${path}' is not a directory.`, {
        code: FS_ERRORS.NOT_A_DIRECTORY,
      });
    }
    throw error;
  }
  const fileOwner = await readLockOwner(path);
  // an owner that can't be read may be a lock released while it was being read
  if (fileOwner === null && !(await pathExists(path))) {
    return free;
  }
  const owner = fileOwner === null ? null : toLockOwner(fileOwner);
  const isLocal = owner !== null && owner.hostname === hostname();
  const isOwnerAlive = owner !== null && isLocal ? isProcessRunning(owner.pid) : null;
  return { name, state: judgeLock(entries, owner, isLocal, isOwnerAlive), owner, isOwnerAlive };
};

/**
 * Acquires a lock as a named program, which `jg-locks run` uses to name the command it runs
 * instead of itself. acquireLock describes the behavior.
 * @param name The lock's name.
 * @param options The wait, the owner's metadata, the dead owner to take over from, and the folder.
 * @param program The program's name, without its arguments.
 * @returns A promise that resolves to the lock.
 * @throws
 * - LOCK_NAME_INVALID: The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.
 * - LOCK_OPTIONS_INVALID: The lock's waitSeconds must be 0 or more, or Infinity.
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 * - LOCK_BUSY: The lock '<path>' is busy.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 * - DIRECTORY_NOT_PRIVATE: The directory '<path>' can be accessed by other users.
 * - PATH_NOT_CANONICAL: The path '<path>' goes through a symbolic link.
 */
export const acquireLockAs = async (
  name: string,
  { waitSeconds = 0, signal, onWait, metadata, recoverFrom, root }: IAcquireLockOptions,
  program: string,
): Promise<ILock> => {
  assertLockName(name);
  assertWaitSeconds(waitSeconds);
  const directory = resolveRoot(root);
  signal?.throwIfAborted();
  await createPrivateDirectory(directory);
  const path = join(directory, name);
  const deadline = performance.now() + waitSeconds * 1000;
  let ownerlessSince: number | null = null;
  let reportedPid: number | null = null;
  while (true) {
    signal?.throwIfAborted();
    let fileLock: IFileLock;
    try {
      fileLock = await acquireFileLock(path, {
        metadata: buildOwnerMetadata(metadata, program, process.cwd(), new Date().toISOString()),
        recoverFrom: recoverFrom === undefined ? undefined : toFileLockOwner(recoverFrom),
      });
    } catch (error) {
      const busy = readLockBusy(error);
      if (busy === undefined) {
        throw error;
      }
      const now = performance.now();
      ownerlessSince = busy.reason === 'ownerless' ? (ownerlessSince ?? now) : null;
      const remainingMs = deadline - now;
      if (!shouldKeepWaiting(busy.reason, remainingMs, now - (ownerlessSince ?? now))) {
        throw error;
      }
      if (busy.reason === 'held' && onWait !== undefined && busy.pid !== reportedPid) {
        reportedPid = busy.pid;
        const state = await inspectLock(name, { root: directory });
        if (state.state === 'held') {
          onWait(state);
        }
      }
      await pause(Math.min(POLL_INTERVAL_MS, remainingMs), signal);
      continue;
    }
    // a lock taken as the signal aborts is the caller's no longer
    if (signal?.aborted === true) {
      await fileLock.release();
      signal.throwIfAborted();
    }
    return toLock(name, fileLock);
  }
};

/**
 * Acquires a named lock that only one process on this machine holds at a time, such as one that
 * guards a port, a browser profile, or a script that mustn't run twice. The lock is a jg-fs lock
 * folder in the locks folder, with an owner.json that names the process: its pid, host, nonce,
 * program, folder, start time, and the caller's metadata, never its arguments, which can hold
 * secrets.
 *
 * With `waitSeconds`, it waits while a live process holds the lock, checking every 250 ms, and
 * calls `onWait` once for each new holder; `Infinity` waits until `signal` aborts. A lock without a
 * readable owner.json is waited on for up to 16 seconds, because a new owner is still writing it.
 * It fails at once, with jg-fs's `LOCK_BUSY` and its `data.reason`, for an owner whose process is
 * gone, one on another host, a takeover in progress, or unexpected files, because waiting can't
 * change them, and with the last reason when the wait runs out. It never takes a lock over by
 * itself: pass the dead owner `inspectLock` gives as `recoverFrom` once what it left is checked. An
 * aborted `signal` rejects with its reason. A lock isn't re-entrant: a process that waits for a lock
 * it already holds waits for itself.
 * @param name The lock's name, such as `acme.app.port-3000`.
 * @param options The wait, the owner's metadata, the dead owner to take over from, and the folder.
 * @returns A promise that resolves to the lock, released with `release()`.
 * @example
 * import { acquireLock } from 'jg-locks';
 *
 * const lock = await acquireLock('acme.app.browser-profile', {
 *   waitSeconds: 60,
 *   onWait: ({ owner }) => console.log(`Waiting for pid ${owner?.pid} to finish`),
 * });
 * try {
 *   // use the browser profile
 * } finally {
 *   await lock.release();
 * }
 * @throws
 * - LOCK_NAME_INVALID: The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.
 * - LOCK_OPTIONS_INVALID: The lock's waitSeconds must be 0 or more, or Infinity.
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 * - LOCK_BUSY: The lock '<path>' is busy.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 * - DIRECTORY_NOT_PRIVATE: The directory '<path>' can be accessed by other users.
 * - PATH_NOT_CANONICAL: The path '<path>' goes through a symbolic link.
 */
export const acquireLock = (name: string, options: IAcquireLockOptions = {}): Promise<ILock> =>
  acquireLockAs(name, options, readProgramName(process.argv[1], process.execPath));

/**
 * Runs a function while holding a lock, and releases the lock when it settles. When the function
 * throws and the release fails too, the release's error is thrown, because the lock stays held.
 * Code that must keep a lock after an uncertain teardown uses acquireLock and doesn't release it.
 * @param name The lock's name.
 * @param options What acquireLock takes.
 * @param fn The function, given the lock.
 * @returns A promise that resolves to what the function returns.
 * @example
 * import { withLock } from 'jg-locks';
 *
 * const report = await withLock('acme.app.nightly-report', { waitSeconds: 30 }, async () => {
 *   return 'written';
 * }); // 'written'
 * @throws
 * - LOCK_NAME_INVALID: The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.
 * - LOCK_OPTIONS_INVALID: The lock's waitSeconds must be 0 or more, or Infinity.
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 * - LOCK_BUSY: The lock '<path>' is busy.
 * - LOCK_ACQUISITION_FAILED: The lock '<path>' could not be acquired.
 * - LOCK_NOT_OWNED: The lock '<path>' is no longer owned by this process.
 * - LOCK_RELEASE_FAILED: The lock '<path>' could not be released.
 * - NOT_A_DIRECTORY: The path '<path>' is not a directory.
 * - DIRECTORY_NOT_PRIVATE: The directory '<path>' can be accessed by other users.
 * - PATH_NOT_CANONICAL: The path '<path>' goes through a symbolic link.
 */
export const withLock = async <T>(
  name: string,
  options: IAcquireLockOptions,
  fn: (lock: ILock) => Promise<T> | T,
): Promise<T> => {
  const lock = await acquireLock(name, options);
  try {
    return await fn(lock);
  } finally {
    await lock.release();
  }
};

/**
 * Lists the locks present in the locks folder, with their states and owners, sorted by name. A
 * folder that doesn't exist yet holds none.
 * @param options The locks folder.
 * @returns A promise that resolves to at most 256 locks, and whether there were more.
 * @example
 * import { listLocks } from 'jg-locks';
 *
 * const { locks } = await listLocks();
 * for (const { name, state, owner } of locks) {
 *   console.log(`${name}: ${state}, pid ${owner?.pid ?? 'unknown'}`);
 * }
 * @throws
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 */
export const listLocks = async ({ root }: ILocksRootOptions = {}): Promise<ILockList> => {
  const directory = resolveRoot(root);
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (getErrorCode(error) === 'ENOENT') {
      return { locks: [], isTruncated: false };
    }
    throw error;
  }
  const names = entries
    .filter((entry) => entry.isDirectory() && isLockName(entry.name))
    .map((entry) => entry.name)
    .sort();
  const states = await Promise.all(
    names.slice(0, MAX_LISTED_LOCKS).map((name) => inspectLock(name, { root: directory })),
  );
  return {
    locks: states.filter((state) => state.state !== 'free'),
    isTruncated: names.length > MAX_LISTED_LOCKS,
  };
};
