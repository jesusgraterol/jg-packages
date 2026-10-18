import type { Pool, PoolClient, PoolConfig, QueryResultRow } from 'pg';

// what createPostgres takes: node-postgres's pool configuration, such as the host, the pool
// size, and connectionTimeoutMillis, statement_timeout, lock_timeout, and
// idle_in_transaction_session_timeout, plus where errors outside any query go
export type IPostgresConfig = Omit<PoolConfig, 'types'> & {
  // receives errors no caller awaits, such as an idle connection the server closed, or a
  // rollback that failed. Defaults to console.error
  onError?: ((error: unknown) => void) | undefined;
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
  // back when it throws. Never start a transaction inside another: run the inner work on the
  // client instead
  transaction: <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>;

  // ends every connection, once queries in flight finish
  close: () => Promise<void>;
};
