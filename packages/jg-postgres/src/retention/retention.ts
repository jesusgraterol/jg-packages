import type { IPostgres } from '../postgres/index.js';
import type { IExpiredRowDeletion, IExpiredRowDeletionOptions } from './types.js';
import { readDeletionPlan, readRetentionCutoff } from './utilities.js';

/**
 * Deletes a table's rows older than a cutoff, a batch at a time, until a batch deletes nothing. The
 * cutoff is computed once, from `olderThan` on the database's clock or from `cutoff`, and a row
 * exactly at it is kept. Each batch is one statement that locks the oldest expired rows, skipping
 * rows another transaction holds, and deletes them by `keyColumn`, which must be unique and not
 * null: a key that repeats would delete rows that haven't expired. With `timeouts`, each batch runs
 * as a transaction of its own with them. A `signal` stops the deletion between batches: once it
 * aborts, no further statement starts, and the call rejects with its reason after the batch in
 * flight settles, leaving the remaining rows for a later call.
 * @param postgres The database.
 * @param options The table, its timestamp and key columns, how old a row must be, and the batches.
 * @returns A promise that resolves to the rows deleted and the cutoff.
 * @example
 * import { createPostgres, deleteExpiredInBatches } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const { deletedCount } = await deleteExpiredInBatches(postgres, {
 *   table: 'audit_event',
 *   olderThan: { months: 6 },
 * });
 * @throws
 * - INVALID_EXPIRED_DELETION: The expired-row deletion needs exactly one of olderThan, with whole months, days, and seconds of at least 0 that are not all 0, and cutoff, a valid date, a whole batch size from 1 to 8192, and filters that each name a column.
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 * - The signal's reason when the signal aborts.
 */
export const deleteExpiredInBatches = async (
  postgres: IPostgres,
  options: IExpiredRowDeletionOptions,
): Promise<IExpiredRowDeletion> => {
  const plan = readDeletionPlan(options);
  const { timeouts, signal } = options;
  signal?.throwIfAborted();
  const cutoff =
    plan.olderThan === undefined
      ? (plan.cutoff as string)
      : await readRetentionCutoff(postgres.pool, plan.olderThan);
  const params: unknown[] = [cutoff];
  const conditions = [`${plan.quotedTable}.${plan.quotedTimestamp} < $1`];
  for (const { quotedColumn, value } of plan.filters) {
    params.push(value);
    conditions.push(`${plan.quotedTable}.${quotedColumn} = $${String(params.length)}`);
  }
  params.push(plan.batchSize);
  const qualifiedKey = `${plan.quotedTable}.${plan.quotedKey}`;
  const text = `WITH expired AS (
  SELECT ${qualifiedKey}
  FROM ${plan.quotedTable}
  WHERE ${conditions.join(' AND ')}
  ORDER BY ${plan.quotedTable}.${plan.quotedTimestamp}, ${qualifiedKey}
  LIMIT $${String(params.length)}
  FOR UPDATE SKIP LOCKED
)
DELETE FROM ${plan.quotedTable}
WHERE ${qualifiedKey} IN (SELECT expired.${plan.quotedKey} FROM expired);`;
  let deletedCount = 0;
  let batchCount: number;
  do {
    signal?.throwIfAborted();
    batchCount =
      timeouts === undefined
        ? Number((await postgres.pool.query(text, params)).rowCount)
        : await postgres.transaction(
            async (client) => Number((await client.query(text, params)).rowCount),
            { timeouts },
          );
    deletedCount += batchCount;
  } while (batchCount > 0);
  return { deletedCount, cutoff };
};
