import type { Pool, PoolClient } from 'pg';

// what runs a query: the pool, or a client checked out from it, such as a transaction's
export type IQueryExecutor = Pool | PoolClient;

// a row's identifier, as a cursor or a row to move
export type IRowId = string | number | bigint;

// an equality condition on one column, such as { column: 'group_id', value: 1 }
export type IColumnFilter = {
  // the column's name, quoted in the SQL
  column: string;

  // the value it must equal, sent as a query parameter
  value: unknown;
};
