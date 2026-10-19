import type { ITransactionOptions } from '../postgres/index.js';

// how runTransaction runs a transaction on a client the caller holds: its timeouts, and where a
// failed ROLLBACK goes
export type IRunTransactionOptions = ITransactionOptions & {
  // receives a ROLLBACK that failed, which leaves the client's state unknown, so it stays in a
  // transaction for isInTransaction. Defaults to console.error
  onError?: ((error: unknown) => void) | undefined;
};
