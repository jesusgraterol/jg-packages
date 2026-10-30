import type { ILockBusyReason } from './types.js';

// the codes of the errors jg-locks throws itself; jg-fs's lock errors, such as LOCK_BUSY, pass through
export const ERRORS = {
  LOCK_NAME_INVALID: 'LOCK_NAME_INVALID',
  LOCK_ROOT_INVALID: 'LOCK_ROOT_INVALID',
  LOCK_OPTIONS_INVALID: 'LOCK_OPTIONS_INVALID',
} as const;

// the environment variable that moves the locks folder, such as to a temporary folder in tests
export const LOCKS_ROOT_VARIABLE = 'JG_LOCKS_ROOT';

// the folder, inside the operating system's state folder, that holds every lock
export const LOCKS_FOLDER_NAME = 'jg-locks';

// a lock's name: lowercase letters, digits, '.', '_' and '-', starting with a letter or a digit
export const LOCK_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

// names Windows reserves for devices, with or without an extension, which can't be folders there
export const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

// how often a wait checks a held lock again, in milliseconds
export const POLL_INTERVAL_MS = 250;

/*
 * How long a lock without a readable owner.json is waited on, in milliseconds. A new owner creates
 * the lock's folder before it writes owner.json, so a lock in that state is usually being taken;
 * one that stays that way was left by a crash at that moment, and stays busy until it's removed by
 * hand.
 */
export const OWNERLESS_GRACE_MS = 16_000;

// why a lock that exists can't be taken, as jg-fs's LOCK_BUSY names it in data.reason
export const LOCK_BUSY_REASONS: ReadonlySet<ILockBusyReason> = new Set([
  'held',
  'owner-gone',
  'ownerless',
  'other-host',
  'recovery-in-progress',
  'unexpected-entries',
]);

// the file that names a lock's owner, and the folder a takeover creates, as jg-fs writes them
export const LOCK_OWNER_FILE = 'owner.json';
export const LOCK_RECOVERY_FOLDER = 'recovery';

// the most locks listLocks returns
export const MAX_LISTED_LOCKS = 256;
