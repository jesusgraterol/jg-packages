/*
 * What a lock is, as inspectLock reads it:
 * - free: no process holds it
 * - held: its owner's process is alive on this host
 * - owner-gone: its owner's process is gone, as after a crash; `jg-locks recover` or `recoverFrom`
 *   takes it over once what the owner left is checked
 * - ownerless: its owner.json is missing or invalid, as while a new owner writes it, or after a
 *   crash at that moment
 * - other-host: its owner runs on another host, such as through a shared folder
 * - recovery-in-progress: another process is taking it over, or crashed while doing so
 * - unexpected-entries: its folder holds files besides owner.json, such as an interrupted write's
 */
export type ILockStateKind =
  | 'free'
  | 'held'
  | 'owner-gone'
  | 'ownerless'
  | 'other-host'
  | 'recovery-in-progress'
  | 'unexpected-entries';

// why a lock that exists can't be taken: every state but free
export type ILockBusyReason = Exclude<ILockStateKind, 'free'>;

// the process that holds a lock, as its owner.json names it
export type ILockOwner = {
  // the process id
  pid: number;

  // a random id that tells this acquisition apart from any other by the same process id
  nonce: string;

  // the host the process runs on
  hostname: string;

  // the entry script or executable that took the lock, without its arguments, which can hold
  // secrets; null when a tool other than jg-locks took it
  program: string | null;

  // the folder the process ran in when it took the lock, or null
  cwd: string | null;

  // when the lock was taken, as an ISO 8601 date, or null
  startedAt: string | null;

  // what the caller wrote about itself, such as a run id
  metadata: Record<string, string>;
};

// a lock and its holder, as inspectLock and listLocks read them
export type ILockState = {
  // the lock's name
  name: string;

  // whether it's free, held, or why it can't be taken
  state: ILockStateKind;

  // its owner, or null when it's free or owner.json can't be read
  owner: ILockOwner | null;

  // whether the owner's process is running, or null when there's no owner or it runs on another host
  isOwnerAlive: boolean | null;
};

// a lock the caller holds until it's released
export type ILock = {
  // the lock's name
  name: string;

  // the caller, as owner.json names it
  owner: ILockOwner;

  // releases the lock; calling it again after it succeeded does nothing
  release: () => Promise<void>;
};

// where the locks are, for every function that reads or takes one
export type ILocksRootOptions = {
  // the absolute path of the locks folder. Defaults to getLocksRoot()
  root?: string | undefined;
};

// what acquireLock and withLock take
export type IAcquireLockOptions = ILocksRootOptions & {
  // how long to wait while another process holds the lock, in seconds, or Infinity to wait until
  // `signal` aborts. Defaults to 0, which fails at once
  waitSeconds?: number | undefined;

  // stops the wait; the call rejects with its reason
  signal?: AbortSignal | undefined;

  // called once for each new holder the wait finds, such as to say what it waits for
  onWait?: ((state: ILockState) => void) | undefined;

  // what to write about the owner, such as a run id; jg-locks sets program, cwd, and startedAt
  // itself. It must fit owner.json's 4 KiB with the rest of the owner
  metadata?: Record<string, string> | undefined;

  // the dead owner, as inspectLock gave it, to take the lock over from once what it left is checked
  recoverFrom?: ILockOwner | undefined;
};

// the locks listLocks found
export type ILockList = {
  // the present locks, sorted by name
  locks: ILockState[];

  // whether there were more locks than listLocks returns
  isTruncated: boolean;
};
