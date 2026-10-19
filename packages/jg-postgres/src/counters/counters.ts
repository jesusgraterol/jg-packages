import type { PoolClient } from 'pg';

import { Exception } from 'jg-exception';

import { quoteIdentifier } from '../identifiers/index.js';
import { ERRORS, POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN } from '../shared/index.js';

import type {
  ICounterChanges,
  ICounterKey,
  ICounterQuery,
  ICounterTable,
  ICounterTableDefinition,
} from './types.js';

/**
 * Builds the exception for a counter change that isn't valid.
 * @returns The INVALID_COUNTER_CHANGE exception.
 */
const invalidChange = (): Exception =>
  new Exception(
    'The counter change needs a value for exactly the key columns, none of them empty, and whole amounts within BIGINT for known counters: positive to increment, non-zero to adjust.',
    { code: ERRORS.INVALID_COUNTER_CHANGE },
  );

/**
 * Checks whether a value is a list of distinct strings with at least one.
 * @param value The value.
 * @returns Whether it is.
 */
const isDistinctNameList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((name) => typeof name === 'string') &&
  new Set(value).size === value.length;

/**
 * Validates a counter table's columns: at least one key column and one counter, all distinct.
 * @param keyColumns The key columns.
 * @param counters The counters.
 * @throws
 * - INVALID_COUNTER_TABLE: The counter table needs at least one key column and one counter, every name distinct.
 */
const assertColumns = (keyColumns: unknown, counters: unknown): void => {
  if (
    !isDistinctNameList(keyColumns) ||
    !isDistinctNameList(counters) ||
    counters.some((counter) => keyColumns.includes(counter))
  ) {
    throw new Exception(
      'The counter table needs at least one key column and one counter, every name distinct.',
      { code: ERRORS.INVALID_COUNTER_TABLE },
    );
  }
};

/**
 * Gives a key value as a query parameter, checking it isn't empty.
 * @param value The value.
 * @returns The parameter, with a bigint as a string.
 * @throws
 * - INVALID_COUNTER_CHANGE: The counter change needs a value for exactly the key columns, none of them empty, and whole amounts within BIGINT for known counters: positive to increment, non-zero to adjust.
 */
const toKeyParameter = (value: unknown): string | number => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if ((typeof value === 'string' && value !== '') || Number.isFinite(value)) {
    return value as string | number;
  }
  throw invalidChange();
};

/**
 * Gives an amount as a query parameter, checking it's whole, within BIGINT, and has the sign the
 * query needs.
 * @param value The amount.
 * @param isIncrement Whether it must be positive, rather than non-zero.
 * @returns The parameter, as a string, so no digit is lost.
 * @throws
 * - INVALID_COUNTER_CHANGE: The counter change needs a value for exactly the key columns, none of them empty, and whole amounts within BIGINT for known counters: positive to increment, non-zero to adjust.
 */
const toAmountParameter = (value: unknown, isIncrement: boolean): string => {
  let amount: bigint;
  if (typeof value === 'bigint') {
    amount = value;
  } else if (Number.isSafeInteger(value)) {
    amount = BigInt(value as number);
  } else {
    throw invalidChange();
  }
  if (
    amount < POSTGRES_BIGINT_MIN ||
    amount > POSTGRES_BIGINT_MAX ||
    (isIncrement ? amount <= 0n : amount === 0n)
  ) {
    throw invalidChange();
  }
  return amount.toString();
};

/**
 * Defines a table of counters, such as an account's daily usage, and gives the functions that
 * build the queries changing its rows. Every name is quoted once, and every value is a parameter.
 * The table needs a unique constraint on exactly the key columns, for the increments' ON CONFLICT,
 * and a default for every counter. Run the queries with `applyCounterQueries`, which orders them
 * so concurrent transactions lock rows in the same order.
 * @param definition The table, its key columns, and its counters.
 * @returns The query builders.
 * @example
 * import { defineCounterTable } from 'jg-postgres';
 *
 * const dailyUsage = defineCounterTable({
 *   table: 'daily_usage',
 *   keyColumns: ['account_id', 'day'],
 *   counters: ['request_count', 'token_count'],
 * });
 * const increment = dailyUsage.buildIncrement(
 *   { account_id: '42', day: '2026-10-19' },
 *   { request_count: 1, token_count: 1_250n },
 * );
 * // increment.text: INSERT INTO "daily_usage" ("account_id", "day", "request_count", "token_count")
 * //   VALUES ($1, $2, $3, $4) ON CONFLICT ("account_id", "day") DO UPDATE SET ...
 * // increment.values: ['42', '2026-10-19', '1', '1250']
 * @throws
 * - INVALID_COUNTER_TABLE: The counter table needs at least one key column and one counter, every name distinct.
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const defineCounterTable = <const K extends string, const C extends string>({
  table,
  keyColumns,
  counters,
}: ICounterTableDefinition<K, C>): ICounterTable<K, C> => {
  assertColumns(keyColumns, counters);
  const quotedTable = quoteIdentifier(table);
  const quotedKeys = keyColumns.map((column) => quoteIdentifier(column));
  const quotedCounters = new Map(counters.map((counter) => [counter, quoteIdentifier(counter)]));
  const keyList = quotedKeys.join(', ');

  /**
   * Gives the key's parameters, in the key columns' order, and the row's lock key.
   * @param key The row's key.
   * @returns The parameters and the lock key.
   * @throws
   * - INVALID_COUNTER_CHANGE: The counter change needs a value for exactly the key columns, none of them empty, and whole amounts within BIGINT for known counters: positive to increment, non-zero to adjust.
   */
  const readKey = (key: ICounterKey<K>): { keyValues: (string | number)[]; lockKey: string } => {
    if (
      typeof key !== 'object' ||
      key === null ||
      Object.keys(key).length !== keyColumns.length ||
      !keyColumns.every((column) => Object.hasOwn(key, column))
    ) {
      throw invalidChange();
    }
    const keyValues = keyColumns.map((column) => toKeyParameter(key[column]));
    return { keyValues, lockKey: JSON.stringify([table, ...keyValues.map(String)]) };
  };

  /**
   * Gives the changed counters, quoted, in the counters' order, with their amounts.
   * @param changes The amounts, by counter.
   * @param isIncrement Whether every amount must be positive, rather than non-zero.
   * @returns The quoted counters and their amounts.
   * @throws
   * - INVALID_COUNTER_CHANGE: The counter change needs a value for exactly the key columns, none of them empty, and whole amounts within BIGINT for known counters: positive to increment, non-zero to adjust.
   */
  const readChanges = (
    changes: ICounterChanges<C>,
    isIncrement: boolean,
  ): { columns: string[]; amounts: string[] } => {
    if (
      typeof changes !== 'object' ||
      changes === null ||
      Object.keys(changes).some((counter) => !quotedCounters.has(counter as C))
    ) {
      throw invalidChange();
    }
    const changed = counters.filter((counter) => Object.hasOwn(changes, counter));
    if (changed.length === 0) {
      throw invalidChange();
    }
    return {
      columns: changed.map((counter) => quotedCounters.get(counter) as string),
      amounts: changed.map((counter) => toAmountParameter(changes[counter], isIncrement)),
    };
  };

  return {
    buildIncrement: (key, increments) => {
      const { keyValues, lockKey } = readKey(key);
      const { columns, amounts } = readChanges(increments, true);
      const placeholders = [...keyValues, ...amounts].map((_, index) => `$${String(index + 1)}`);
      const updates = columns.map(
        (column) => `${column} = ${quotedTable}.${column} + EXCLUDED.${column}`,
      );
      return {
        text: `INSERT INTO ${quotedTable} (${[...quotedKeys, ...columns].join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (${keyList}) DO UPDATE SET ${updates.join(', ')};`,
        values: [...keyValues, ...amounts],
        lockKey,
      };
    },
    buildAdjustment: (key, changes) => {
      const { keyValues, lockKey } = readKey(key);
      const { columns, amounts } = readChanges(changes, false);
      const updates = columns.map(
        (column, index) => `${column} = ${column} + $${String(keyValues.length + index + 1)}`,
      );
      const conditions = quotedKeys.map((column, index) => `${column} = $${String(index + 1)}`);
      return {
        text: `UPDATE ${quotedTable} SET ${updates.join(', ')} WHERE ${conditions.join(' AND ')};`,
        values: [...keyValues, ...amounts],
        lockKey,
      };
    },
  };
};

/**
 * Compares two lock keys by UTF-16 code unit, the same way on every machine and in every locale.
 * @param first The first query.
 * @param second The second query.
 * @returns A negative number, zero, or a positive number.
 */
const compareLockKeys = (first: ICounterQuery, second: ICounterQuery): number =>
  first.lockKey < second.lockKey ? -1 : first.lockKey > second.lockKey ? 1 : 0;

/**
 * Runs counter queries one after another on a transaction's client, sorted by their lock keys, so
 * two transactions changing the same rows lock them in the same order and never deadlock each
 * other. Queries for the same row keep their order. Each must change exactly one row, so an
 * adjustment of a row that doesn't exist throws, and the caller's transaction rolls back. A counter
 * that would leave BIGINT's range fails with SQLSTATE 22003, as isNumericValueOutOfRangeError
 * checks.
 * @param client The client of the transaction to run them in.
 * @param queries The queries, from defineCounterTable's builders. The list isn't changed.
 * @returns A promise that resolves once every query ran.
 * @example
 * import { applyCounterQueries, createPostgres, defineCounterTable } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const balances = defineCounterTable({
 *   table: 'account_balance',
 *   keyColumns: ['account_id'],
 *   counters: ['credit_count'],
 * });
 * await postgres.transaction((client) =>
 *   applyCounterQueries(client, [
 *     balances.buildAdjustment({ account_id: '42' }, { credit_count: -10 }),
 *     balances.buildIncrement({ account_id: '7' }, { credit_count: 10 }),
 *   ]),
 * );
 * @throws
 * - COUNTER_ROW_NOT_FOUND: The counter query changed no row, because the row to adjust doesn't exist.
 */
export const applyCounterQueries = async (
  client: PoolClient,
  queries: readonly ICounterQuery[],
): Promise<void> => {
  for (const { text, values, lockKey } of queries.toSorted(compareLockKeys)) {
    const { rowCount } = await client.query({ text, values });
    if (rowCount !== 1) {
      throw new Exception(
        "The counter query changed no row, because the row to adjust doesn't exist.",
        { code: ERRORS.COUNTER_ROW_NOT_FOUND, data: { lockKey } },
      );
    }
  }
};
