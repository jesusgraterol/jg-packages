// types
export type {
  IAcquireLockOptions,
  ILock,
  ILockBusyReason,
  ILockList,
  ILockOwner,
  ILocksRootOptions,
  ILockState,
  ILockStateKind,
} from './types.js';

// constants
export { ERRORS } from './constants.js';

// utilities
export { isLockName } from './utilities.js';

// locks
export {
  acquireLock,
  acquireLockAs,
  getLocksRoot,
  inspectLock,
  listLocks,
  withLock,
} from './locks.js';
