import type { IFileLockOwner } from '../../shared/index.js';

// a lock acquireLock holds until it's released
export type IFileLock = {
  // the lock's directory
  path: string;

  // the process that holds it, as its owner.json names it
  owner: IFileLockOwner;

  // removes the lock; calling it again after it succeeded does nothing
  release: () => void;
};
