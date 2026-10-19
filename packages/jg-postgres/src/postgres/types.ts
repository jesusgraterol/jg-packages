import type { Pool, PoolClient, PoolConfig, QueryResultRow } from 'pg';

import type { ITimeoutProfile } from '../timeouts/index.js';

// what createPostgres takes: node-postgres's pool configuration, such as the host, the pool
// size, and connectionTimeoutMillis, statement_timeout, lock_timeout, and
// idle_in_transaction_session_timeout, plus where errors outside any query go
export type IPostgresConfig = Omit<PoolConfig, 'types'> & {
  // receives errors no caller awaits, such as an idle connection the server closed, or a
  // rollback that failed. Defaults to console.error
  onError?: ((error: unknown) => void) | undefined;
};

// how a transaction runs
export type ITransactionOptions = {
  // the statement and lock timeouts for this transaction only, from defineTimeoutProfile. The
  // pool's query_timeout still applies to each query that doesn't set its own, so pass the
  // operation's queries through withQueryTimeout with the same profile. A query the client stops
  // waiting for is rolled back: the client goes back to the pool once ROLLBACK, which waits for the
  // server and has the pool's query_timeout too, confirms the connection, and is destroyed otherwise
  timeouts?: ITimeoutProfile | undefined;
};

// a database: its pool, and the helpers that use it
export type IPostgres = {
  // the node-postgres pool, for what the helpers don't cover
  readonly pool: Pool;

  // runs a query on the pool and returns its rows
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: readonly unknown[],
  ) => Promise<T[]>;

  // runs an operation in a transaction on one client, committing when it resolves and rolling
  // back when it throws, optionally with timeouts of its own. Never start a transaction inside
  // another: run the inner work on the client instead
  transaction: <T>(
    operation: (client: PoolClient) => Promise<T>,
    options?: ITransactionOptions,
  ) => Promise<T>;

  // ends every connection, once queries in flight finish
  close: () => Promise<void>;
};
