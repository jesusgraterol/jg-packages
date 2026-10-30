// error codes
export { ERRORS } from './locks/index.js';

// locks
export {
  type IAcquireLockOptions,
  type ILock,
  type ILockBusyReason,
  type ILockList,
  type ILockOwner,
  type ILocksRootOptions,
  type ILockState,
  type ILockStateKind,
  acquireLock,
  getLocksRoot,
  inspectLock,
  listLocks,
  withLock,
} from './locks/index.js';
