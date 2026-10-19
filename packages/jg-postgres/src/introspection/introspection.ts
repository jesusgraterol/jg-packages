import type { IQueryExecutor } from '../shared/index.js';

import type {
  IDatabaseSummary,
  IDatabaseSummaryRow,
  IIntrospectionOptions,
  ITableSize,
} from './types.js';
import { toDatabaseSummary } from './utilities.js';

// the schema whose tables are read when the options don't name one
const DEFAULT_SCHEMA = 'public';

/**
 * Reads a summary of the database the executor is connected to, such as for an admin dashboard:
 * its name, the server's version, its size, its active connections out of the server's maximum,
 * and the ordinary tables in a schema. Without the pg_read_all_stats role, PostgreSQL shows only
 * the role's own connections, so activeConnections undercounts.
 * @param executor The pool, or a client.
 * @param options The schema whose tables are counted.
 * @returns A promise that resolves to the summary.
 * @example
 * import { createPostgres, readDatabaseSummary } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const summary = await readDatabaseSummary(postgres.pool);
 * // { name: 'app', serverVersion: '18.1', serverVersionNumber: 180001, sizeBytes: 8_000_000,
 * //   activeConnections: 3, maxConnections: 100, tableCount: 12 }
 */
export const readDatabaseSummary = async (
  executor: IQueryExecutor,
  { schema = DEFAULT_SCHEMA }: IIntrospectionOptions = {},
): Promise<IDatabaseSummary> => {
  const { rows } = await executor.query<IDatabaseSummaryRow>(
    `SELECT
      current_database() AS name,
      current_setting('server_version') AS server_version,
      current_setting('server_version_num')::integer AS server_version_number,
      pg_database_size(current_database()) AS size_bytes,
      (
        SELECT count(*)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = current_database()
          AND pg_stat_activity.state = 'active'
      ) AS active_connections,
      current_setting('max_connections')::integer AS max_connections,
      (
        SELECT count(*)
        FROM pg_class
        JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
        WHERE pg_namespace.nspname = $1
          AND pg_class.relkind = 'r'
      ) AS table_count;`,
    [schema],
  );
  // the query has no FROM, so it always gives one row
  return toDatabaseSummary(rows[0] as IDatabaseSummaryRow);
};

/**
 * Lists the ordinary tables in a schema with their total size on disk, indexes and TOAST data
 * included, sorted by name.
 * @param executor The pool, or a client.
 * @param options The schema.
 * @returns A promise that resolves to the tables.
 * @example
 * import { createPostgres, listTableSizes } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const tables = await listTableSizes(postgres.pool);
 * // [{ name: 'app_user', totalBytes: 65_536 }, { name: 'session', totalBytes: 16_384 }]
 */
export const listTableSizes = async (
  executor: IQueryExecutor,
  { schema = DEFAULT_SCHEMA }: IIntrospectionOptions = {},
): Promise<ITableSize[]> => {
  const { rows } = await executor.query<{ name: string; total_bytes: string }>(
    `SELECT pg_class.relname AS name, pg_total_relation_size(pg_class.oid) AS total_bytes
    FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = $1
      AND pg_class.relkind = 'r'
    ORDER BY pg_class.relname;`,
    [schema],
  );
  return rows.map(({ name, total_bytes }) => ({ name, totalBytes: Number(total_bytes) }));
};
