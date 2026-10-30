import type { ILockOwner, ILockStateKind } from '../locks/index.js';

// where the CLI writes its output and its errors
export type ICliOutput = {
  out: { write: (text: string) => unknown };
  err: { write: (text: string) => unknown };
};

// a lock in `jg-locks status --json`
export type ILockStatusRecord = {
  name: string;
  state: ILockStateKind;
  isOwnerAlive: boolean | null;

  // for how long the holder has held the lock, or null when its start time is unknown
  heldSeconds: number | null;
  owner: ILockOwner | null;
};
