import type { QueryResultRow } from 'pg';

import { quoteIdentifier } from '../identifiers/index.js';
import type { IQueryExecutor } from '../shared/index.js';
import type { ICursorListingOptions, ICursorPage } from './types.js';

/**
 * Lists a page of a table's rows after a cursor, ordered by the cursor column. Every name is
 * quoted, and the order and the cursor comparison use the table's own column, so a selected
 * column can't change them.
 * @param executor The pool, or a transaction's client.
 * @param options The table, its columns, the cursor column and direction, filters, the previous
 * page's last cursor, and the limit.
 * @returns A promise that resolves to the rows.
 * @example
 * import { createPostgres, listByCursor } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const errors = await listByCursor<{ id: string; origin: string }>(postgres.pool, {
 *   table: 'api_error',
 *   columns: ['id', 'origin'],
 *   filters: [{ column: 'origin', value: 'api-admin' }],
 *   after: '120',
 *   limit: 20,
 * });
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const listByCursor = async <T extends QueryResultRow = QueryResultRow>(
  executor: IQueryExecutor,
  {
    table,
    columns,
    cursorColumn = 'id',
    sortDirection = 'DESC',
    filters = [],
    after,
    limit,
  }: ICursorListingOptions,
): Promise<T[]> => {
  const quotedTable = quoteIdentifier(table);
  const qualifiedCursor = `${quotedTable}.${quoteIdentifier(cursorColumn)}`;
  const params: unknown[] = [];
  const conditions: string[] = [];
  for (const { column, value } of filters) {
    params.push(value);
    conditions.push(`${quotedTable}.${quoteIdentifier(column)} = $${params.length}`);
  }
  if (after !== undefined) {
    params.push(after);
    conditions.push(`${qualifiedCursor} ${sortDirection === 'DESC' ? '<' : '>'} $${params.length}`);
  }
  params.push(limit);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await executor.query<T>(
    `SELECT ${columns.map(quoteIdentifier).join(', ')}
       FROM ${quotedTable}
       ${where}
       ORDER BY ${qualifiedCursor} ${sortDirection === 'DESC' ? 'DESC' : 'ASC'}
       LIMIT $${params.length};`,
    params,
  );
  return rows;
};

/**
 * Builds a page from rows listed with one more than the page's size, so the extra row tells
 * whether another page follows without counting the table.
 * @param rows The rows, listed with a limit of the page size plus one.
 * @param limit The page size.
 * @param toCursor Reads the cursor from a row, such as its ID.
 * @returns The page's rows, and the last one's cursor when more follow, otherwise null.
 * @example
 * import { buildCursorPage } from 'jg-postgres';
 *
 * buildCursorPage([{ id: '3' }, { id: '2' }, { id: '1' }], 2, ({ id }) => id);
 * // => { items: [{ id: '3' }, { id: '2' }], nextCursor: '2' }
 */
export const buildCursorPage = <T>(
  rows: readonly T[],
  limit: number,
  toCursor: (row: T) => string,
): ICursorPage<T> => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last !== undefined ? toCursor(last) : null,
  };
};
