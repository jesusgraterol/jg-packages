// @vitest-environment node
import type { PoolClient } from 'pg';

import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS, POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN } from '../shared/index.js';

import { applyCounterQueries, defineCounterTable } from './counters.js';
import type { ICounterQuery } from './types.js';

const DAILY_USAGE = defineCounterTable({
  table: 'daily_usage',
  keyColumns: ['account_id', 'day'],
  counters: ['request_count', 'token_count'],
});

const KEY = { account_id: '42', day: '2026-10-19' };

/**
 * Builds a client that records each query's text, and reports a row count for it.
 * @param rowCounts The row counts to report, in order; 1 once they run out.
 * @returns The client and the texts it ran.
 */
const createRecordingClient = (
  rowCounts: number[] = [],
): { client: PoolClient; texts: string[] } => {
  const texts: string[] = [];
  const query = vi.fn(({ text }: { text: string }) => {
    texts.push(text);
    return Promise.resolve({ rowCount: rowCounts.shift() ?? 1 });
  });
  return { client: { query } as unknown as PoolClient, texts };
};

describe('defineCounterTable', () => {
  test('builds an increment that inserts the row or adds to it, with every value a parameter', () => {
    expect(
      DAILY_USAGE.buildIncrement(KEY, { request_count: 1, token_count: 1_250n }),
    ).toStrictEqual({
      text: 'INSERT INTO "daily_usage" ("account_id", "day", "request_count", "token_count") VALUES ($1, $2, $3, $4) ON CONFLICT ("account_id", "day") DO UPDATE SET "request_count" = "daily_usage"."request_count" + EXCLUDED."request_count", "token_count" = "daily_usage"."token_count" + EXCLUDED."token_count";',
      values: ['42', '2026-10-19', '1', '1250'],
      lockKey: '["daily_usage","42","2026-10-19"]',
    });
  });

  test('builds an adjustment of an existing row, with only the counters given, in their order', () => {
    expect(
      DAILY_USAGE.buildAdjustment({ day: '2026-10-19', account_id: 42 }, { token_count: -5 }),
    ).toStrictEqual({
      text: 'UPDATE "daily_usage" SET "token_count" = "token_count" + $3 WHERE "account_id" = $1 AND "day" = $2;',
      values: [42, '2026-10-19', '-5'],
      lockKey: '["daily_usage","42","2026-10-19"]',
    });
    expect(
      DAILY_USAGE.buildAdjustment(KEY, { token_count: 2, request_count: 3n }).values,
    ).toStrictEqual(['42', '2026-10-19', '3', '2']);
  });

  test('quotes every name once, escaping its quotes', () => {
    const table = defineCounterTable({
      table: 'usage "daily"',
      keyColumns: ['Account'],
      counters: ['request count'],
    });

    expect(table.buildAdjustment({ Account: 7n }, { 'request count': 1 }).text).toBe(
      'UPDATE "usage ""daily""" SET "request count" = "request count" + $2 WHERE "Account" = $1;',
    );
  });

  test('accepts the edges of BIGINT', () => {
    expect(DAILY_USAGE.buildIncrement(KEY, { request_count: POSTGRES_BIGINT_MAX }).values[2]).toBe(
      '9223372036854775807',
    );
    expect(DAILY_USAGE.buildAdjustment(KEY, { request_count: POSTGRES_BIGINT_MIN }).values[2]).toBe(
      '-9223372036854775808',
    );
  });

  test.each<[string, Record<string, unknown>]>([
    ['no key columns', { keyColumns: [] }],
    ['no counters', { counters: [] }],
    ['key columns that are not a list', { keyColumns: 'account_id' }],
    ['a counter that is not a string', { counters: [1] }],
    ['a repeated key column', { keyColumns: ['account_id', 'account_id'] }],
    ['a repeated counter', { counters: ['request_count', 'request_count'] }],
    ['a column that is a key and a counter', { counters: ['account_id'] }],
  ])('throws INVALID_COUNTER_TABLE for %s', (_, overrides) => {
    expectToThrowCode(
      () =>
        defineCounterTable({
          table: 'daily_usage',
          keyColumns: ['account_id'],
          counters: ['request_count'],
          ...overrides,
        }),
      ERRORS.INVALID_COUNTER_TABLE,
      'The counter table needs at least one key column and one counter, every name distinct.',
    );
  });

  test.each<[string, Record<string, unknown>]>([
    ['an empty table name', { table: '' }],
    ['an empty column name', { keyColumns: [''] }],
    ['a counter name of 64 bytes', { counters: ['c'.repeat(64)] }],
  ])('throws INVALID_IDENTIFIER for %s', (_, overrides) => {
    expectToThrowCode(
      () =>
        defineCounterTable({
          table: 'daily_usage',
          keyColumns: ['account_id'],
          counters: ['request_count'],
          ...overrides,
        }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });

  test.each<[string, unknown, unknown]>([
    ['a missing key column', { account_id: '42' }, { request_count: 1 }],
    ['an extra key column', { ...KEY, region: 'eu' }, { request_count: 1 }],
    ['a null key value', { ...KEY, day: null }, { request_count: 1 }],
    ['an undefined key value', { ...KEY, day: undefined }, { request_count: 1 }],
    ['an empty key value', { ...KEY, day: '' }, { request_count: 1 }],
    ['a key value that is not finite', { ...KEY, account_id: Number.NaN }, { request_count: 1 }],
    ['a key that is not an object', null, { request_count: 1 }],
    ['no counters', KEY, {}],
    ['changes that are not an object', KEY, null],
    ['an unknown counter', KEY, { request_count: 1, error_count: 1 }],
    ['a zero increment', KEY, { request_count: 0 }],
    ['a negative increment', KEY, { request_count: -1 }],
    ['a fractional increment', KEY, { request_count: 1.5 }],
    ['an unsafe number', KEY, { request_count: 2 ** 53 }],
    ['an increment past BIGINT', KEY, { request_count: POSTGRES_BIGINT_MAX + 1n }],
    ['an amount that is a string', KEY, { request_count: '1' }],
  ])('buildIncrement throws INVALID_COUNTER_CHANGE for %s', (_, key, increments) => {
    expectToThrowCode(
      () => DAILY_USAGE.buildIncrement(key as never, increments as never),
      ERRORS.INVALID_COUNTER_CHANGE,
      'The counter change needs a value for exactly the key columns',
    );
  });

  test.each<[string, unknown]>([
    ['a zero adjustment', { request_count: 0 }],
    ['a zero bigint adjustment', { request_count: 0n }],
    ['an adjustment below BIGINT', { request_count: POSTGRES_BIGINT_MIN - 1n }],
  ])('buildAdjustment throws INVALID_COUNTER_CHANGE for %s', (_, changes) => {
    expectToThrowCode(
      () => DAILY_USAGE.buildAdjustment(KEY, changes as never),
      ERRORS.INVALID_COUNTER_CHANGE,
    );
  });
});

describe('applyCounterQueries', () => {
  test('runs a sorted copy by lock key, keeping the order of queries for the same row', async () => {
    const { client, texts } = createRecordingClient();
    const queries: ICounterQuery[] = [
      { text: 'b-first', values: [], lockKey: '["t","b"]' },
      { text: 'a', values: [], lockKey: '["t","a"]' },
      { text: 'b-second', values: [], lockKey: '["t","b"]' },
      { text: 'upper', values: [], lockKey: '["t","B"]' },
    ];
    const original = [...queries];

    await applyCounterQueries(client, queries);

    // by code unit, so 'B' sorts before 'a' in every locale
    expect(texts).toStrictEqual(['upper', 'a', 'b-first', 'b-second']);
    expect(queries).toStrictEqual(original);
  });

  test('runs the same order whatever order the queries come in', async () => {
    const first = createRecordingClient();
    const second = createRecordingClient();
    const queries = [
      DAILY_USAGE.buildIncrement({ ...KEY, account_id: '7' }, { request_count: 1 }),
      DAILY_USAGE.buildIncrement(KEY, { request_count: 1 }),
    ];

    await applyCounterQueries(first.client, queries);
    await applyCounterQueries(second.client, queries.toReversed());

    expect(first.texts).toStrictEqual(second.texts);
  });

  test('throws COUNTER_ROW_NOT_FOUND when a query changes no row, and runs no more', async () => {
    const { client, texts } = createRecordingClient([1, 0]);
    const queries = [
      DAILY_USAGE.buildAdjustment({ ...KEY, account_id: '1' }, { request_count: -1 }),
      DAILY_USAGE.buildAdjustment({ ...KEY, account_id: '2' }, { request_count: -1 }),
      DAILY_USAGE.buildAdjustment({ ...KEY, account_id: '3' }, { request_count: -1 }),
    ];

    await expectToRejectCode(
      applyCounterQueries(client, queries),
      ERRORS.COUNTER_ROW_NOT_FOUND,
      "The counter query changed no row, because the row to adjust doesn't exist.",
    );
    expect(texts).toHaveLength(2);
  });

  test('runs nothing for no queries', async () => {
    const { client, texts } = createRecordingClient();

    await applyCounterQueries(client, []);

    expect(texts).toStrictEqual([]);
  });
});
