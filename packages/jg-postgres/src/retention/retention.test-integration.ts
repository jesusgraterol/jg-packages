// @vitest-environment node
import type { QueryResult } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { isDatabaseError } from '../database-errors/index.js';
import type { IPostgres } from '../postgres/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { defineTimeoutProfile } from '../timeouts/index.js';
import { deleteExpiredInBatches } from './retention.js';
import { readRetentionCutoff } from './utilities.js';

const CUTOFF = '2026-01-01T00:00:00.000Z';

let postgres: IPostgres;

beforeAll(() => {
  postgres = connectTestPostgres({ max: 6 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

/**
 * Creates a table of events with an id and a creation time, for one test.
 * @param extraColumns More column definitions, such as `tenant_id integer NOT NULL DEFAULT 1`.
 * @returns A promise that resolves to the table's name.
 */
const createEventTable = async (extraColumns = ''): Promise<string> => {
  const table = createTableName('retention');
  await postgres.query(
    `CREATE TABLE ${table} (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at timestamptz NOT NULL${extraColumns === '' ? '' : `, ${extraColumns}`}
    );`,
  );
  return table;
};

/**
 * Inserts events created a number of seconds before a time.
 * @param table The table.
 * @param count How many events.
 * @param secondsBefore How long before the time they were created, 0 for exactly at it.
 * @param time The time, CUTOFF by default.
 */
const insertEvents = async (
  table: string,
  count: number,
  secondsBefore: number,
  time = CUTOFF,
): Promise<void> => {
  await postgres.query(
    `INSERT INTO ${table} (created_at)
    SELECT $1::timestamptz - make_interval(secs => $2 + series.index)
    FROM generate_series(0, $3 - 1) AS series (index);`,
    [time, secondsBefore, count],
  );
};

/**
 * Counts a table's rows.
 * @param table The table.
 * @returns A promise that resolves to the count.
 */
const countRows = async (table: string): Promise<number> =>
  (
    await postgres.query<{ row_count: number }>(
      `SELECT count(*)::integer AS row_count FROM ${table};`,
    )
  )[0]?.row_count ?? -1;

describe('deleteExpiredInBatches', () => {
  test('deletes 513 expired rows in batches of 256, 256, and 1, keeping a row at the cutoff', async () => {
    const table = await createEventTable();
    await insertEvents(table, 513, 1);
    await insertEvents(table, 1, 0);
    await insertEvents(table, 1, -60);
    const querySpy = vi.spyOn(postgres.pool, 'query');

    const result = await deleteExpiredInBatches(postgres, {
      table,
      cutoff: CUTOFF,
      batchSize: 256,
    });

    const batches = await Promise.all(
      querySpy.mock.results.map(
        async ({ value }) => (await (value as Promise<QueryResult>)).rowCount,
      ),
    );
    expect(batches).toStrictEqual([256, 256, 1, 0]);
    expect(result).toStrictEqual({ deletedCount: 513, cutoff: CUTOFF });
    expect(
      await postgres.query<{ created_at: string }>(
        `SELECT created_at FROM ${table} ORDER BY created_at;`,
      ),
    ).toStrictEqual([{ created_at: CUTOFF }, { created_at: '2026-01-01T00:01:00.000Z' }]);
  });

  test.each([
    ['2024-08-31T00:00:00.000Z', '2024-02-29T00:00:00.000Z'],
    ['2025-08-31T00:00:00.000Z', '2025-02-28T00:00:00.000Z'],
    ['2026-03-31T01:30:00.000Z', '2025-09-30T01:30:00.000Z'],
  ])('counts six calendar months back from %s, in UTC, to %s', async (time, expected) => {
    await expect(
      readRetentionCutoff(postgres.pool, { months: 6, days: 0, seconds: 0 }, time),
    ).resolves.toBe(expected);
    // a session in another time zone gets the same UTC calendar arithmetic
    const elsewhere = connectTestPostgres({ max: 1, options: '-c TimeZone=Pacific/Kiritimati' });
    try {
      await expect(
        readRetentionCutoff(elsewhere.pool, { months: 6, days: 0, seconds: 0 }, time),
      ).resolves.toBe(expected);
    } finally {
      await elsewhere.close();
    }
  });

  test('stops between batches once the signal aborts, rejecting with its reason, and a later call finishes', async () => {
    const table = await createEventTable();
    await insertEvents(table, 5, 1);
    const controller = new AbortController();
    const reason = new Error('The app is shutting down.');
    const realQuery = postgres.pool.query.bind(postgres.pool) as (
      text: string,
      params: unknown[],
    ) => Promise<QueryResult>;
    const deletions: number[] = [];
    // the abort arrives while the first batch is in flight, as a shutdown would
    vi.spyOn(postgres.pool, 'query').mockImplementation((async (
      text: string,
      params: unknown[],
    ) => {
      if (text.startsWith('WITH expired')) {
        controller.abort(reason);
      }
      const result = await realQuery(text, params);
      if (text.startsWith('WITH expired')) {
        deletions.push(Number(result.rowCount));
      }
      return result;
    }) as never);

    await expect(
      deleteExpiredInBatches(postgres, {
        table,
        cutoff: CUTOFF,
        batchSize: 2,
        signal: controller.signal,
      }),
    ).rejects.toBe(reason);
    expect(deletions).toStrictEqual([2]);
    expect(await countRows(table)).toBe(3);

    vi.restoreAllMocks();
    await expect(
      deleteExpiredInBatches(postgres, { table, cutoff: CUTOFF, batchSize: 2 }),
    ).resolves.toStrictEqual({ deletedCount: 3, cutoff: CUTOFF });
    expect(await countRows(table)).toBe(0);
  });

  test('runs no statement when the signal has already aborted', async () => {
    const table = await createEventTable();
    await insertEvents(table, 2, 1);
    const querySpy = vi.spyOn(postgres.pool, 'query');
    const reason = new Error('Already stopped.');

    await expect(
      deleteExpiredInBatches(postgres, {
        table,
        olderThan: { days: 1 },
        signal: AbortSignal.abort(reason),
      }),
    ).rejects.toBe(reason);
    expect(querySpy).not.toHaveBeenCalled();
    expect(await countRows(table)).toBe(2);
  });

  test('subtracts months, then days, then seconds', async () => {
    await expect(
      readRetentionCutoff(
        postgres.pool,
        { months: 1, days: 2, seconds: 3_600 },
        '2026-03-31T12:00:00.000Z',
      ),
    ).resolves.toBe('2026-02-26T11:00:00.000Z');
  });

  test("counts olderThan back from the database's clock, once", async () => {
    const table = await createEventTable();
    const now = new Date().toISOString();
    await insertEvents(table, 3, 7_200, now);
    await insertEvents(table, 2, 1_800, now);

    const before = Date.now();
    const { deletedCount, cutoff } = await deleteExpiredInBatches(postgres, {
      table,
      olderThan: { seconds: 3_600 },
      batchSize: 2,
    });

    expect(deletedCount).toBe(3);
    expect(Math.abs(Date.parse(cutoff) - (before - 3_600_000))).toBeLessThan(10_000);
    expect(await countRows(table)).toBe(2);
  });

  test('deletes by another unique key column', async () => {
    const table = createTableName('retention_key');
    await postgres.query(
      `CREATE TABLE ${table} (
        event_uuid uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        recorded_at timestamptz NOT NULL
      );`,
    );
    await postgres.query(
      `INSERT INTO ${table} (recorded_at)
      SELECT $1::timestamptz - make_interval(secs => series.index)
      FROM generate_series(-2, 4) AS series (index);`,
      [CUTOFF],
    );

    await expect(
      deleteExpiredInBatches(postgres, {
        table,
        timestampColumn: 'recorded_at',
        keyColumn: 'event_uuid',
        cutoff: CUTOFF,
        batchSize: 2,
      }),
    ).resolves.toStrictEqual({ deletedCount: 4, cutoff: CUTOFF });
    expect(await countRows(table)).toBe(3);
  });

  test('deletes only the rows the filters match', async () => {
    const table = await createEventTable('tenant_id integer NOT NULL DEFAULT 1');
    await insertEvents(table, 4, 10);
    await postgres.query(`UPDATE ${table} SET tenant_id = 2 WHERE id % 2 = 0;`);

    const { deletedCount } = await deleteExpiredInBatches(postgres, {
      table,
      cutoff: CUTOFF,
      filters: [{ column: 'tenant_id', value: 2 }],
    });

    expect(deletedCount).toBe(2);
    expect(
      await postgres.query<{ tenant_id: number }>(`SELECT DISTINCT tenant_id FROM ${table};`),
    ).toStrictEqual([{ tenant_id: 1 }]);
  });

  test('quotes a table and columns named with reserved words', async () => {
    await postgres.query(
      'CREATE TABLE "user" ("order" integer PRIMARY KEY, "end" timestamptz NOT NULL);',
    );
    try {
      await postgres.query(
        `INSERT INTO "user" VALUES (1, $1::timestamptz - interval '1 day'), (2, $1::timestamptz);`,
        [CUTOFF],
      );
      await expect(
        deleteExpiredInBatches(postgres, {
          table: 'user',
          timestampColumn: 'end',
          keyColumn: 'order',
          cutoff: CUTOFF,
        }),
      ).resolves.toStrictEqual({ deletedCount: 1, cutoff: CUTOFF });
      expect(await postgres.query('SELECT "order" FROM "user";')).toStrictEqual([{ order: 2 }]);
    } finally {
      await postgres.query('DROP TABLE "user";');
    }
  });

  test("stops at the profile's lock timeout while another transaction locks the table", async () => {
    const table = await createEventTable();
    await insertEvents(table, 2, 10);
    const locker = await postgres.pool.connect();
    try {
      await locker.query(`BEGIN; LOCK TABLE ${table} IN ACCESS EXCLUSIVE MODE;`);
      const startedAt = Date.now();

      const error = await deleteExpiredInBatches(postgres, {
        table,
        cutoff: CUTOFF,
        timeouts: defineTimeoutProfile({ statementTimeoutSeconds: 5, lockTimeoutSeconds: 1 }),
      }).catch((cause: unknown) => cause);

      expect(isDatabaseError(error)).toBe(true);
      expect(error).toMatchObject({ code: '55P03' });
      expect(Date.now() - startedAt).toBeLessThan(4_000);
    } finally {
      await locker.query('ROLLBACK;');
      locker.release();
    }
    await expect(
      deleteExpiredInBatches(postgres, {
        table,
        cutoff: CUTOFF,
        timeouts: defineTimeoutProfile({ statementTimeoutSeconds: 5, lockTimeoutSeconds: 1 }),
      }),
    ).resolves.toStrictEqual({ deletedCount: 2, cutoff: CUTOFF });
  });

  test('skips a row another transaction holds, leaving it for the next run', async () => {
    const table = await createEventTable();
    await insertEvents(table, 3, 10);
    const holder = await postgres.pool.connect();
    try {
      await holder.query(`BEGIN; SELECT id FROM ${table} ORDER BY created_at LIMIT 1 FOR UPDATE;`);

      await expect(
        deleteExpiredInBatches(postgres, { table, cutoff: CUTOFF }),
      ).resolves.toMatchObject({ deletedCount: 2 });
    } finally {
      await holder.query('ROLLBACK;');
      holder.release();
    }
    await expect(
      deleteExpiredInBatches(postgres, { table, cutoff: CUTOFF }),
    ).resolves.toMatchObject({ deletedCount: 1 });
    expect(await countRows(table)).toBe(0);
  });

  test('lets two concurrent runs delete every expired row exactly once', async () => {
    const table = await createEventTable();
    await insertEvents(table, 2_000, 1);
    await insertEvents(table, 5, -10);

    const results = await Promise.all([
      deleteExpiredInBatches(postgres, { table, cutoff: CUTOFF, batchSize: 64 }),
      deleteExpiredInBatches(postgres, { table, cutoff: CUTOFF, batchSize: 64 }),
    ]);

    expect(results[0].deletedCount + results[1].deletedCount).toBe(2_000);
    expect(await countRows(table)).toBe(5);
  });
});
