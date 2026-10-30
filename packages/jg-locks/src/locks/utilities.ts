import { basename, posix, win32 } from 'node:path';
import { Exception, isException } from 'jg-exception';
import { ERRORS as FS_ERRORS, type IFileLockOwner } from 'jg-fs';

import {
  ERRORS,
  LOCK_BUSY_REASONS,
  LOCK_NAME_PATTERN,
  LOCK_OWNER_FILE,
  LOCK_RECOVERY_FOLDER,
  LOCKS_FOLDER_NAME,
  LOCKS_ROOT_VARIABLE,
  OWNERLESS_GRACE_MS,
  WINDOWS_DEVICE_NAMES,
} from './constants.js';
import type { ILockBusyReason, ILockOwner } from './types.js';

// where a locks folder that isn't an absolute path came from
type ILocksRootSource = 'root' | typeof LOCKS_ROOT_VARIABLE | 'LOCALAPPDATA' | 'home';

/**
 * Builds the exception for a locks folder that isn't an absolute path.
 * @param source Where the path came from.
 * @returns The LOCK_ROOT_INVALID exception.
 */
const rootInvalid = (source: ILocksRootSource): Exception =>
  new Exception('The locks folder must be an absolute path.', {
    code: ERRORS.LOCK_ROOT_INVALID,
    data: { source },
  });

/**
 * Checks whether a name can name a lock: it matches LOCK_NAME_PATTERN, doesn't end with '.', which
 * Windows drops, and isn't a Windows device name, with or without an extension.
 * @param name The name.
 * @returns Whether it's a lock name.
 */
export const isLockName = (name: unknown): name is string =>
  typeof name === 'string' &&
  LOCK_NAME_PATTERN.test(name) &&
  !name.endsWith('.') &&
  !WINDOWS_DEVICE_NAMES.has(name.split('.')[0] ?? '');

/**
 * Checks that a name can name a lock.
 * @param name The name.
 * @throws
 * - LOCK_NAME_INVALID: The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.
 */
export const assertLockName: (name: unknown) => asserts name is string = (name) => {
  if (!isLockName(name)) {
    throw new Exception(
      "The lock name must be 1 to 128 lowercase letters, digits, '.', '_' and '-', start with a letter or a digit, not end with '.', and not be a Windows device name.",
      {
        code: ERRORS.LOCK_NAME_INVALID,
        data: { name: typeof name === 'string' ? name.slice(0, 256) : null },
      },
    );
  }
};

/**
 * Resolves the default locks folder: JG_LOCKS_ROOT when it's set, otherwise `jg-locks` in the
 * operating system's state folder, `%LOCALAPPDATA%` on Windows, and `$XDG_STATE_HOME`, or
 * `~/.local/state`, elsewhere. A relative `XDG_STATE_HOME` is ignored, as the XDG specification
 * says.
 * @param env The environment variables.
 * @param platform The operating system.
 * @param homeDirectory The user's home folder.
 * @returns The folder's absolute path.
 * @throws
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 */
export const resolveLocksRoot = (
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  homeDirectory: string,
): string => {
  const paths = platform === 'win32' ? win32 : posix;
  const override = env[LOCKS_ROOT_VARIABLE];
  if (override !== undefined && override !== '') {
    if (!paths.isAbsolute(override)) {
      throw rootInvalid(LOCKS_ROOT_VARIABLE);
    }
    return paths.normalize(override);
  }
  if (platform === 'win32') {
    const localAppData = env['LOCALAPPDATA'];
    if (localAppData === undefined || !win32.isAbsolute(localAppData)) {
      throw rootInvalid('LOCALAPPDATA');
    }
    return win32.join(localAppData, LOCKS_FOLDER_NAME);
  }
  const stateHome = env['XDG_STATE_HOME'];
  if (stateHome !== undefined && posix.isAbsolute(stateHome)) {
    return posix.join(stateHome, LOCKS_FOLDER_NAME);
  }
  if (!posix.isAbsolute(homeDirectory)) {
    throw rootInvalid('home');
  }
  return posix.join(homeDirectory, '.local', 'state', LOCKS_FOLDER_NAME);
};

/**
 * Checks that a locks folder a caller passed is an absolute path on this operating system.
 * @param root The folder.
 * @param platform The operating system.
 * @throws
 * - LOCK_ROOT_INVALID: The locks folder must be an absolute path.
 */
export const assertLocksRoot = (root: unknown, platform: NodeJS.Platform): void => {
  const paths = platform === 'win32' ? win32 : posix;
  if (typeof root !== 'string' || !paths.isAbsolute(root)) {
    throw rootInvalid('root');
  }
};

/**
 * Checks how long acquireLock may wait.
 * @param waitSeconds The seconds, 0 or more, or Infinity.
 * @throws
 * - LOCK_OPTIONS_INVALID: The lock's waitSeconds must be 0 or more, or Infinity.
 */
export const assertWaitSeconds = (waitSeconds: unknown): void => {
  if (typeof waitSeconds !== 'number' || Number.isNaN(waitSeconds) || waitSeconds < 0) {
    throw new Exception("The lock's waitSeconds must be 0 or more, or Infinity.", {
      code: ERRORS.LOCK_OPTIONS_INVALID,
    });
  }
};

/**
 * Reads why jg-fs refused a busy lock, and the holder's process id when it named one.
 * @param error What acquiring the lock threw.
 * @returns The reason and the pid, or undefined when the error isn't jg-fs's LOCK_BUSY.
 */
export const readLockBusy = (
  error: unknown,
): { reason: ILockBusyReason; pid: number | null } | undefined => {
  if (!isException(error) || error.code !== FS_ERRORS.LOCK_BUSY) {
    return undefined;
  }
  const { data } = error;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return undefined;
  }
  const reason = data['reason'];
  const pid = data['pid'];
  if (typeof reason !== 'string' || !(LOCK_BUSY_REASONS as ReadonlySet<string>).has(reason)) {
    return undefined;
  }
  return { reason: reason as ILockBusyReason, pid: typeof pid === 'number' ? pid : null };
};

/**
 * Decides whether a wait for a busy lock goes on: while a live owner holds it, and through a lock
 * without a readable owner for at most OWNERLESS_GRACE_MS, in both cases only while the wait has
 * time left. Any other reason fails at once, because waiting can't change it.
 * @param reason Why the lock is busy.
 * @param remainingMs The milliseconds the wait has left, Infinity for a wait without a limit.
 * @param ownerlessMs The milliseconds the lock has been ownerless in a row, 0 when it isn't.
 * @returns Whether to try again.
 */
export const shouldKeepWaiting = (
  reason: ILockBusyReason,
  remainingMs: number,
  ownerlessMs: number,
): boolean => {
  if (remainingMs <= 0) {
    return false;
  }
  if (reason === 'held') {
    return true;
  }
  return reason === 'ownerless' && ownerlessMs < OWNERLESS_GRACE_MS;
};

/**
 * Judges a lock whose folder exists, in the order jg-fs judges it when it refuses one, so
 * inspectLock and acquireLock agree.
 * @param entries The names in the lock's folder.
 * @param owner Its owner, or null when owner.json can't be read.
 * @param isLocal Whether the owner runs on this host.
 * @param isOwnerAlive Whether the owner's process is running, null when that can't be checked.
 * @returns Why the lock is busy.
 */
export const judgeLock = (
  entries: readonly string[],
  owner: ILockOwner | null,
  isLocal: boolean,
  isOwnerAlive: boolean | null,
): ILockBusyReason => {
  if (entries.includes(LOCK_RECOVERY_FOLDER)) {
    return 'recovery-in-progress';
  }
  if (owner === null) {
    return 'ownerless';
  }
  if (!isLocal) {
    return 'other-host';
  }
  if (isOwnerAlive !== false) {
    return 'held';
  }
  return entries.every((entry) => entry === LOCK_OWNER_FILE) ? 'owner-gone' : 'unexpected-entries';
};

/**
 * Names the program that takes a lock: the entry script, or the executable when there's none,
 * without the folder it's in or its arguments.
 * @param entryScript The script Node.js started with, `process.argv[1]`.
 * @param executable The executable, `process.execPath`.
 * @returns The program's name.
 */
export const readProgramName = (entryScript: string | undefined, executable: string): string =>
  basename(entryScript === undefined || entryScript === '' ? executable : entryScript);

/**
 * Builds owner.json's metadata: the caller's, with the program, folder, and start time jg-locks
 * writes, which replace any the caller gave under the same keys.
 * @param metadata The caller's metadata.
 * @param program The program's name.
 * @param cwd The folder it runs in.
 * @param startedAt When it takes the lock, as an ISO 8601 date.
 * @returns The metadata.
 */
export const buildOwnerMetadata = (
  metadata: Record<string, string> | undefined,
  program: string,
  cwd: string,
  startedAt: string,
): Record<string, string> => ({
  ...metadata,
  program,
  cwd,
  startedAt,
});

/**
 * Reads jg-fs's owner as a lock owner, splitting the fields jg-locks writes from the caller's
 * metadata.
 * @param owner jg-fs's owner.
 * @returns The lock owner.
 */
export const toLockOwner = (owner: IFileLockOwner): ILockOwner => {
  const { program, cwd, startedAt, ...metadata } = owner.metadata ?? {};
  return {
    pid: owner.pid,
    nonce: owner.nonce,
    hostname: owner.hostname,
    program: program ?? null,
    cwd: cwd ?? null,
    startedAt: startedAt ?? null,
    metadata,
  };
};

/**
 * Turns a lock owner back into the jg-fs owner a takeover names, which jg-fs matches by its
 * process id, nonce, and host.
 * @param owner The lock owner.
 * @returns jg-fs's owner.
 */
export const toFileLockOwner = (owner: ILockOwner): IFileLockOwner => ({
  pid: owner.pid,
  nonce: owner.nonce,
  hostname: owner.hostname,
});
