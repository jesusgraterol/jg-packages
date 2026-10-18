import type { PoolClient } from 'pg';

// what withSessionLock gives the operation while it holds the lock
export type ISessionLock = {
  // the client that holds the lock, for work that must stop when the lock does
  readonly client: PoolClient;

  // whether the lock's connection is still alive, so the lock is still held
  isActive: () => boolean;

  // throws SESSION_LOCK_LOST when the lock's connection was lost
  assertActive: () => void;

  // marks the client as unsafe to reuse, such as after work on it ended in an unknown state, so
  // it's destroyed instead of returned to the pool
  destroyClient: () => void;
};

// what withSessionLock resolves to: whether it got the lock, and the operation's result when it did
export type ISessionLockResult<T> = { acquired: false } | { acquired: true; result: T };
