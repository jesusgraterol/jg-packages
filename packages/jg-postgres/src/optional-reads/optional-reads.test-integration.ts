import type { PoolClient } from 'pg';
import { afterEach, describe, expect, test, vi } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { connectTestPostgres } from '../test-utils/database.js';
import { defineTimeoutProfile } from '../timeouts/index.js';

import { createOptionalReader } from './optional-reads.js';

// timeouts long enough for a deliberately slow read
const SLOW_READ_TIMEOUTS = defineTimeoutProfile({
  statementTimeoutSeconds: 3,
  lockTimeoutSeconds: 0.1,
  queryGraceSeconds: 1,
});

/**
 * Reads the number in a row's `value` column.
 * @param row The row.
 * @returns The number.
 */
const parseValue = (row: unknown): number => (row as { value: number }).value;

// the databases each test opened, closed after it
const opened: IPostgres[] = [];

/**
 * Connects to the test database with a pool of a given size.
 * @param max The pool's size.
 * @returns The database.
 */
const connect = (max: number): IPostgres => {
  const postgres = connectTestPostgres({ max, statement_timeout: 60_000 });
  opened.push(postgres);
  return postgres;
};

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(opened.splice(0).map((postgres) => postgres.close()));
});

describe('createOptionalReader', () => {
  test('reads the first row on a cold pool, and shares a running read by its key', async () => {
    const postgres = connect(4);
    const reader = createOptionalReader({ postgres });

    const first = reader.read(
      'answer',
      { text: 'SELECT $1::int AS value;', values: [42] },
      parseValue,
    );
    const joined = reader.read('answer', { text: 'SELECT 0 AS value;' }, parseValue);

    expect(joined).toBe(first);
    expect(first.getSnapshot()).toBeNull();
    expect(await first.completion).toBe(42);
    expect(first.getSnapshot()).toBe(42);
  });

  test('skips a read past maxActiveReads, and admits one again once a slot is free', async () => {
    const postgres = connect(8);
    const reader = createOptionalReader({
      postgres,
      maxActiveReads: 1,
      timeouts: SLOW_READ_TIMEOUTS,
    });

    const slow = reader.read('slow', { text: 'SELECT 1 AS value FROM pg_sleep(0.3);' }, parseValue);
    const skipped = reader.read('other', { text: 'SELECT 2 AS value;' }, parseValue);

    expect(skipped.getSnapshot()).toBeNull();
    expect(await skipped.completion).toBeNull();
    expect(await slow.completion).toBe(1);
    expect(await reader.read('other', { text: 'SELECT 2 AS value;' }, parseValue).completion).toBe(
      2,
    );
  });

  test('skips a read while a request waits for a client', async () => {
    const postgres = connect(1);
    const reader = createOptionalReader({ postgres, reservedIdleClients: 0 });
    const holding = await postgres.pool.connect();
    const waiting = postgres.pool.connect();

    const read = reader.read('busy', { text: 'SELECT 1 AS value;' }, parseValue);

    expect(postgres.pool.waitingCount).toBe(1);
    expect(await read.completion).toBeNull();
    holding.release();
    (await waiting).release();
  });

  test("skips a read when the pool can't give more clients than the reserved ones", async () => {
    const postgres = connect(2);
    const reader = createOptionalReader({ postgres, reservedIdleClients: 2 });

    expect(
      await reader.read('reserved', { text: 'SELECT 1 AS value;' }, parseValue).completion,
    ).toBeNull();
  });

  test('gives null at the deadline, and releases a client that arrives late without using it', async () => {
    const postgres = connect(4);
    const reader = createOptionalReader({ postgres, admissionSeconds: 0.1 });
    const client = await postgres.pool.connect();
    const release = vi.spyOn(client, 'release');
    const query = vi.spyOn(client, 'query');
    // the client arrives 300 ms after the read asks for it, past its 100 ms deadline
    const arrival = new Promise<PoolClient>((resolve) => {
      setTimeout(() => {
        resolve(client);
      }, 300);
    });
    vi.spyOn(postgres.pool, 'connect').mockReturnValueOnce(arrival as never);

    const read = reader.read('late', { text: 'SELECT 1 AS value;' }, parseValue);

    expect(await read.completion).toBeNull();
    await vi.waitFor(
      () => {
        expect(release).toHaveBeenCalledExactlyOnceWith(false);
      },
      { timeout: 2_000 },
    );
    expect(query).not.toHaveBeenCalled();
    expect(read.getSnapshot()).toBeNull();
  });

  test(
    'destroys a client whose SQL runs past the deadline, which also stops the SQL',
    { tags: ['full'] },
    async () => {
      const postgres = connect(4);
      const reader = createOptionalReader({
        postgres,
        admissionSeconds: 0.2,
        timeouts: SLOW_READ_TIMEOUTS,
      });
      const client = await postgres.pool.connect();
      const release = vi.spyOn(client, 'release');
      vi.spyOn(postgres.pool, 'connect').mockResolvedValueOnce(client as never);

      const read = reader.read('slow', { text: 'SELECT 1 AS value FROM pg_sleep(2);' }, parseValue);

      expect(await read.completion).toBeNull();
      await vi.waitFor(() => {
        expect(release).toHaveBeenCalledExactlyOnceWith(true);
      });
    },
  );

  test('gives null, and never throws, when the query fails or its row cannot be parsed', async () => {
    const postgres = connect(4);
    const reader = createOptionalReader({ postgres });

    const broken = reader.read(
      'broken',
      { text: 'SELECT * FROM a_table_that_does_not_exist;' },
      parseValue,
    );
    const unparsable = reader.read('unparsable', { text: 'SELECT 1 AS value;' }, () => {
      throw new Error('The row is not a counter.');
    });

    expect(await broken.completion).toBeNull();
    expect(await unparsable.completion).toBeNull();
  });

  test("leaves the client with the pool's settings, outside any transaction", async () => {
    const postgres = connect(1);
    const reader = createOptionalReader({ postgres, reservedIdleClients: 0 });

    expect(
      await reader.read('settings', { text: 'SELECT 1 AS value;' }, parseValue).completion,
    ).toBe(1);
    const [settings] = await postgres.query<{
      statement: string;
      lock: string;
      transaction: string;
    }>(
      "SELECT current_setting('statement_timeout') AS statement, current_setting('lock_timeout') AS lock, current_setting('transaction_read_only') AS transaction;",
    );

    expect(settings).toStrictEqual({ statement: '1min', lock: '0', transaction: 'off' });
  });
});
