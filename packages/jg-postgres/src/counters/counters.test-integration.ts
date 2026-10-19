// @vitest-environment node
import { setTimeout as sleep } from 'node:timers/promises';

import type { PoolClient, QueryConfig } from 'pg';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  isDeadlockDetectedError,
  isNumericValueOutOfRangeError,
} from '../database-errors/index.js';
import { quoteIdentifier } from '../identifiers/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS, POSTGRES_BIGINT_MAX } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';

import { applyCounterQueries, defineCounterTable } from './counters.js';
import type { ICounterQuery } from './types.js';

let postgres: IPostgres;
let table: string;
let usage: ReturnType<
  typeof defineCounterTable<'account_id' | 'day', 'request_count' | 'token_count'>
>;

// a row of the test's counter table
type IUsageRow = { account_id: string; request_count: string; token_count: string };

/**
 * Runs counter queries in a transaction of their own.
 * @param queries The queries.
 * @returns A promise that resolves once the transaction committed.
 */
const apply = (queries: ICounterQuery[]): Promise<void> =>
  postgres.transaction((client) => applyCounterQueries(client, queries));

/**
 * Reads the counters of every account, by account.
 * @returns A promise that resolves to the rows.
 */
const readRows = (): Promise<IUsageRow[]> =>
  postgres.query<IUsageRow>(
    `SELECT account_id, request_count, token_count FROM ${quoteIdentifier(table)} ORDER BY account_id;`,
  );

/**
 * Wraps a transaction's client so it waits after every query, holding the row locks it took, so
 * a second transaction takes its own locks meanwhile.
 * @param client The client.
 * @returns The wrapped client.
 */
const createSlowClient = (client: PoolClient): PoolClient => {
  const query = client.query.bind(client) as (config: QueryConfig) => Promise<unknown>;
  return {
    query: async (config: QueryConfig) => {
      const result = await query(config);
      await sleep(250);
      return result;
    },
  } as unknown as PoolClient;
};

beforeAll(() => {
  postgres = connectTestPostgres({ max: 8 });
});

beforeEach(async () => {
  table = createTableName('counters');
  await postgres.query(
    `CREATE TABLE ${quoteIdentifier(table)} (
      account_id text NOT NULL,
      day date NOT NULL,
      request_count bigint NOT NULL DEFAULT 0,
      token_count bigint NOT NULL DEFAULT 0,
      UNIQUE (account_id, day)
    );`,
  );
  usage = defineCounterTable({
    table,
    keyColumns: ['account_id', 'day'],
    counters: ['request_count', 'token_count'],
  });
});

afterAll(async () => {
  await postgres.close();
});

describe('counter queries', () => {
  test('insert the row with its first increment, then add to it', async () => {
    const key = { account_id: 'a', day: '2026-10-19' };

    await apply([usage.buildIncrement(key, { request_count: 1 })]);
    expect(await readRows()).toStrictEqual([
      { account_id: 'a', request_count: '1', token_count: '0' },
    ]);

    await apply([
      usage.buildIncrement(key, { request_count: 2, token_count: 5n }),
      usage.buildAdjustment(key, { token_count: -1 }),
    ]);
    expect(await readRows()).toStrictEqual([
      { account_id: 'a', request_count: '3', token_count: '4' },
    ]);
  });

  test('add every one of 16 concurrent increments, the first ones inserting the row', async () => {
    const key = { account_id: 'a', day: '2026-10-19' };

    await Promise.all(
      Array.from({ length: 16 }, () => apply([usage.buildIncrement(key, { request_count: 1 })])),
    );

    expect(await readRows()).toStrictEqual([
      { account_id: 'a', request_count: '16', token_count: '0' },
    ]);
  });

  test("throw COUNTER_ROW_NOT_FOUND for an adjustment of a missing row, rolling back the transaction's other changes", async () => {
    const day = '2026-10-19';
    await apply([usage.buildIncrement({ account_id: 'a', day }, { request_count: 1 })]);

    await expectToRejectCode(
      apply([
        usage.buildIncrement({ account_id: 'a', day }, { request_count: 1 }),
        usage.buildAdjustment({ account_id: 'b', day }, { request_count: -1 }),
      ]),
      ERRORS.COUNTER_ROW_NOT_FOUND,
    );

    expect(await readRows()).toStrictEqual([
      { account_id: 'a', request_count: '1', token_count: '0' },
    ]);
  });

  test('fail with SQLSTATE 22003 when a counter would leave BIGINT', async () => {
    const key = { account_id: 'a', day: '2026-10-19' };
    await apply([usage.buildIncrement(key, { request_count: POSTGRES_BIGINT_MAX })]);
    let error: unknown;

    try {
      await apply([usage.buildIncrement(key, { request_count: 1 })]);
    } catch (caught) {
      error = caught;
    }

    expect(isNumericValueOutOfRangeError(error)).toBe(true);
    expect(await readRows()).toStrictEqual([
      { account_id: 'a', request_count: POSTGRES_BIGINT_MAX.toString(), token_count: '0' },
    ]);
  });

  test('never deadlock two transactions given the same rows in reversed orders', async () => {
    const day = '2026-10-19';
    const first = { account_id: 'a', day };
    const second = { account_id: 'b', day };
    await apply([
      usage.buildIncrement(first, { request_count: 1 }),
      usage.buildIncrement(second, { request_count: 1 }),
    ]);
    const forward = [
      usage.buildAdjustment(first, { request_count: 1 }),
      usage.buildAdjustment(second, { request_count: 1 }),
    ];
    const runSlowly = (queries: ICounterQuery[], isSorted: boolean): Promise<void> =>
      postgres.transaction(async (client) => {
        const slowClient = createSlowClient(client);
        if (isSorted) {
          await applyCounterQueries(slowClient, queries);
          return;
        }
        for (const { text, values } of queries) {
          await slowClient.query({ text, values });
        }
      });

    // the same queries, run as given, deadlock, which shows the slow client makes them overlap
    const unsorted = await Promise.allSettled([
      runSlowly(forward, false),
      runSlowly(forward.toReversed(), false),
    ]);
    expect(
      unsorted.some(
        (result) => result.status === 'rejected' && isDeadlockDetectedError(result.reason),
      ),
    ).toBe(true);

    await Promise.all([runSlowly(forward, true), runSlowly(forward.toReversed(), true)]);

    const rows = await readRows();
    expect(rows.map((row) => row.request_count)).toStrictEqual(['4', '4']);
  });
});
