import type { IDatabaseSummary, IDatabaseSummaryRow, ITableDiff } from './types.js';

/**
 * Converts the summary query's row, whose BIGINT counts and sizes are strings, to the summary.
 * @param row The row.
 * @returns The summary.
 */
export const toDatabaseSummary = (row: IDatabaseSummaryRow): IDatabaseSummary => ({
  name: row.name,
  serverVersion: row.server_version,
  serverVersionNumber: row.server_version_number,
  sizeBytes: Number(row.size_bytes),
  activeConnections: Number(row.active_connections),
  maxConnections: row.max_connections,
  tableCount: Number(row.table_count),
});

/**
 * Compares the tables a schema has with the ones an app expects, such as in a health check after
 * a migration. Names compare exactly, as PostgreSQL stores them.
 * @param actual The tables that exist, such as listTableSizes' names.
 * @param expected The tables the app expects.
 * @returns The expected tables that are missing, and the tables that aren't expected, each sorted
 * and without duplicates.
 * @example
 * import { diffTables } from 'jg-postgres';
 *
 * diffTables(['app_user', 'session'], ['app_user', 'invitation']);
 * // => { missing: ['invitation'], unexpected: ['session'] }
 */
export const diffTables = (actual: readonly string[], expected: readonly string[]): ITableDiff => {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return {
    missing: [...expectedSet].filter((name) => !actualSet.has(name)).sort(),
    unexpected: [...actualSet].filter((name) => !expectedSet.has(name)).sort(),
  };
};
