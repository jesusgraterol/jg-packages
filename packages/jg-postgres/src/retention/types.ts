import type { IColumnFilter } from '../shared/index.js';
import type { ITimeoutProfile } from '../timeouts/index.js';

// how old a row must be to be deleted: calendar months and days, then seconds, each a whole number
// of at least 0, not all 0, counted back from the database's clock on the UTC calendar
export type IRetentionAge = {
  months?: number | undefined;
  days?: number | undefined;
  seconds?: number | undefined;
};

// which rows deleteExpiredInBatches deletes, and how
export type IExpiredRowDeletionOptions = {
  // the table, quoted in the SQL
  table: string;

  // the column whose time a row expires by. Defaults to `created_at`
  timestampColumn?: string | undefined;

  // a unique, non-null column the batches delete by, such as the primary key. Defaults to `id`
  keyColumn?: string | undefined;

  // how old a row must be, from the database's clock. Give this or cutoff
  olderThan?: IRetentionAge | undefined;

  // the time rows older than which are deleted. Give this or olderThan
  cutoff?: string | Date | undefined;

  // the rows each statement deletes: 1 to 8,192. Defaults to 1,024
  batchSize?: number | undefined;

  // equality conditions a row must also meet, such as one tenant's rows
  filters?: readonly IColumnFilter[] | undefined;

  // the statement and lock timeouts of each batch, which then runs as a transaction of its own
  timeouts?: ITimeoutProfile | undefined;
};

// what deleteExpiredInBatches resolves to: the rows it deleted, and the cutoff it deleted them by,
// as an ISO 8601 UTC timestamp
export type IExpiredRowDeletion = {
  deletedCount: number;
  cutoff: string;
};
