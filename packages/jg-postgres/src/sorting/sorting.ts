import type { PoolClient } from 'pg';

import { Exception } from 'jg-exception';

import { quoteIdentifier } from '../identifiers/index.js';
import { createAdvisoryLockKey, lockTransaction } from '../locks/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS, type IRowId } from '../shared/index.js';
import type { IMoveOptions, IMoveStatus, IOrderedList } from './types.js';

/**
 * Builds the advisory lock key that covers a whole ordered list, the same for every process that
 * names the list the same way, whatever order its scope is given in.
 * @param list The ordered list.
 * @returns The lock's key.
 */
const createOrderedListLockKey = ({
  table,
  sortOrderColumn = 'sort_order',
  scope = [],
}: IOrderedList): string => {
  const base = `database:move:${table}:${sortOrderColumn}`;
  if (scope.length === 0) {
    return createAdvisoryLockKey(base);
  }
  const scopeKey = scope
    .toSorted((first, second) => first.column.localeCompare(second.column))
    .map(({ column, value }) => `${column}:${String(value)}`)
    .join('|');
  return createAdvisoryLockKey(`${base}:${scopeKey}`);
};

/**
 * Locks an ordered list for the rest of a transaction, so no move or append changes it
 * meanwhile, such as before appending a row after the list's last sort order. moveUp and moveDown
 * take the same lock.
 * @param client The transaction's client.
 * @param list The table, its sort order column, and the scope that picks one list.
 * @returns A promise that resolves once the lock is held.
 * @example
 * import { createPostgres, lockOrderedList } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * await postgres.transaction(async (client) => {
 *   await lockOrderedList(client, { table: 'category', scope: [{ column: 'group_id', value: 1 }] });
 *   await client.query(
 *     `INSERT INTO category (group_id, sort_order)
 *        SELECT 1, COALESCE(MAX(sort_order), 0) + 10 FROM category WHERE group_id = 1;`,
 *   );
 * });
 */
export const lockOrderedList = async (client: PoolClient, list: IOrderedList): Promise<void> => {
  await lockTransaction(client, createOrderedListLockKey(list));
};

/**
 * Checks what the move query reports, and throws when the move didn't happen.
 * @param rowId The row that was to move.
 * @param status The move query's report.
 * @param direction The direction it was to move in.
 * @throws
 * - MOVE_FAILED: The move did not update exactly two rows.
 * - ROW_NOT_FOUND: The row does not exist in the ordered list.
 * - ROW_ALREADY_FIRST: The row is already first in the ordered list.
 * - ROW_ALREADY_LAST: The row is already last in the ordered list.
 */
const assertMoved = (
  rowId: IRowId,
  status: IMoveStatus | undefined,
  direction: 'up' | 'down',
): void => {
  const data = { id: String(rowId), direction };
  if (status === undefined) {
    throw new Exception('The move did not update exactly two rows.', {
      code: ERRORS.MOVE_FAILED,
      data,
    });
  }
  if (!status.has_current) {
    throw new Exception('The row does not exist in the ordered list.', {
      code: ERRORS.ROW_NOT_FOUND,
      data,
    });
  }
  if (!status.has_neighbor) {
    throw direction === 'up'
      ? new Exception('The row is already first in the ordered list.', {
          code: ERRORS.ROW_ALREADY_FIRST,
          data,
        })
      : new Exception('The row is already last in the ordered list.', {
          code: ERRORS.ROW_ALREADY_LAST,
          data,
        });
  }
  if (status.updated_count !== 2) {
    throw new Exception('The move did not update exactly two rows.', {
      code: ERRORS.MOVE_FAILED,
      data: { ...data, updatedCount: status.updated_count },
    });
  }
};

/**
 * Swaps a row's sort order with its neighbor's, in its own transaction under the ordered list's
 * lock.
 * @param postgres The database.
 * @param rowId The row to move.
 * @param options The ordered list, its constraint, and its ID column.
 * @param direction Which neighbor to swap with.
 * @returns A promise that resolves once the swap commits.
 */
const move = async (
  postgres: IPostgres,
  rowId: IRowId,
  options: IMoveOptions,
  direction: 'up' | 'down',
): Promise<void> => {
  const {
    sortOrderConstraint,
    idColumn = 'id',
    sortOrderColumn = 'sort_order',
    scope = [],
  } = options;
  const table = quoteIdentifier(options.table);
  const id = quoteIdentifier(idColumn);
  const order = quoteIdentifier(sortOrderColumn);
  const scopeClause = scope
    .map(({ column }, index) => `AND ${table}.${quoteIdentifier(column)} = $${index + 2}`)
    .join(' ');
  const [comparison, neighborOrder] = direction === 'up' ? ['<', 'DESC'] : ['>', 'ASC'];
  await postgres.transaction(async (client) => {
    await lockOrderedList(client, options);
    // the swap briefly gives two rows the same sort order, which the deferred check allows
    await client.query(`SET CONSTRAINTS ${quoteIdentifier(sortOrderConstraint)} DEFERRED;`);
    const { rows } = await client.query<IMoveStatus>(
      `WITH current_entry AS (
         SELECT ${table}.${id}, ${table}.${order}
           FROM ${table}
           WHERE ${table}.${id} = $1 ${scopeClause}
           FOR UPDATE
       ),
       neighbor_entry AS (
         SELECT ${table}.${id}, ${table}.${order}
           FROM ${table}
           WHERE ${table}.${order} ${comparison} (SELECT ${order} FROM current_entry) ${scopeClause}
           ORDER BY ${table}.${order} ${neighborOrder}
           LIMIT 1
           FOR UPDATE
       ),
       updated_entries AS (
         UPDATE ${table} AS entry
           SET ${order} = CASE
             WHEN entry.${id} = current_entry.${id} THEN neighbor_entry.${order}
             ELSE current_entry.${order}
           END
           FROM current_entry, neighbor_entry
           WHERE entry.${id} IN (current_entry.${id}, neighbor_entry.${id})
           RETURNING entry.${id}
       )
       SELECT
         EXISTS (SELECT 1 FROM current_entry) AS has_current,
         EXISTS (SELECT 1 FROM neighbor_entry) AS has_neighbor,
         (SELECT count(*)::integer FROM updated_entries) AS updated_count;`,
      [rowId, ...scope.map(({ value }) => value)],
    );
    assertMoved(rowId, rows[0], direction);
  });
};

/**
 * Moves a row one place up an ordered list, by swapping its sort order with the closest smaller
 * one, in its own transaction under the list's lock.
 * @param postgres The database, from createPostgres.
 * @param rowId The row's identifier.
 * @param options The table, its sort order constraint, and, when they differ from the defaults,
 * its ID and sort order columns, and the scope that picks one list.
 * @returns A promise that resolves once the move commits.
 * @example
 * import { createPostgres, moveUp } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * await moveUp(postgres, 42, { table: 'category', sortOrderConstraint: 'uq_category__sort_order' });
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 * - MOVE_FAILED: The move did not update exactly two rows.
 * - ROW_NOT_FOUND: The row does not exist in the ordered list.
 * - ROW_ALREADY_FIRST: The row is already first in the ordered list.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 */
export const moveUp = async (
  postgres: IPostgres,
  rowId: IRowId,
  options: IMoveOptions,
): Promise<void> => move(postgres, rowId, options, 'up');

/**
 * Moves a row one place down an ordered list, by swapping its sort order with the closest larger
 * one, in its own transaction under the list's lock.
 * @param postgres The database, from createPostgres.
 * @param rowId The row's identifier.
 * @param options The table, its sort order constraint, and, when they differ from the defaults,
 * its ID and sort order columns, and the scope that picks one list.
 * @returns A promise that resolves once the move commits.
 * @example
 * import { createPostgres, moveDown } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * await moveDown(postgres, 42, { table: 'category', sortOrderConstraint: 'uq_category__sort_order' });
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 * - MOVE_FAILED: The move did not update exactly two rows.
 * - ROW_NOT_FOUND: The row does not exist in the ordered list.
 * - ROW_ALREADY_LAST: The row is already last in the ordered list.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 */
export const moveDown = async (
  postgres: IPostgres,
  rowId: IRowId,
  options: IMoveOptions,
): Promise<void> => move(postgres, rowId, options, 'down');
