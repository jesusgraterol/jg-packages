import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { isDatabaseError } from '../database-errors/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';

import { defineTimeoutProfile, withQueryTimeout } from './timeouts.js';

// one client, so every query after a transaction runs on the client it used, when it was kept
const onError = vi.fn();
let postgres: IPostgres;

// a profile longer than the pool's one-second client timeout
const LONG = defineTimeoutProfile({ statementTimeoutSeconds: 3, lockTimeoutSeconds: 0.1 });

/**
 * Reads a setting of the session that runs the query.
 * @param run Runs the query, on a client or the pool.
 * @param name The setting.
 * @returns A promise that resolves to its value, as SHOW gives it.
 */
const readSetting = async (
  run: (text: string) => Promise<{ value: string }[]>,
  name: string,
): Promise<string | undefined> =>
  (await run(`SELECT current_setting('${name}') AS value;`))[0]?.value;

/**
 * Reads the server process of the session that runs the query.
 * @param run Runs the query, on a client or the pool.
 * @returns A promise that resolves to the pid.
 */
const readBackendPid = async (run: (text: string) => Promise<{ pid: number }[]>) =>
  (await run('SELECT pg_backend_pid() AS pid;'))[0]?.pid;

beforeAll(() => {
  postgres = connectTestPostgres({
    max: 1,
    statement_timeout: 60_000,
    lock_timeout: 30_000,
    query_timeout: 1_000,
    onError,
  });
});

afterEach(() => {
  onError.mockClear();
});

afterAll(async () => {
  await postgres.close();
});

describe('transaction timeouts', () => {
  test('apply inside the transaction only, and the client keeps the pool defaults afterwards', async () => {
    const inside = await postgres.transaction(
      async (client) => ({
        statement: await readSetting(
          async (text) => (await client.query<{ value: string }>(text)).rows,
          'statement_timeout',
        ),
        lock: await readSetting(
          async (text) => (await client.query<{ value: string }>(text)).rows,
          'lock_timeout',
        ),
        pid: await readBackendPid(async (text) => (await client.query<{ pid: number }>(text)).rows),
      }),
      { timeouts: LONG },
    );

    expect(inside).toMatchObject({ statement: '3s', lock: '100ms' });
    expect(await readBackendPid((text) => postgres.query(text))).toBe(inside.pid);
    expect(await readSetting((text) => postgres.query(text), 'statement_timeout')).toBe('1min');
    expect(await readSetting((text) => postgres.query(text), 'lock_timeout')).toBe('30s');
  });

  test('stop waiting for a lock another session holds', async () => {
    const table = createTableName('timeouts_lock');
    const holder = connectTestPostgres();
    await postgres.query(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY);`);
    await postgres.query(`INSERT INTO ${table} VALUES (1);`);
    const holding = await holder.pool.connect();
    try {
      await holding.query('BEGIN;');
      await holding.query(`SELECT id FROM ${table} WHERE id = 1 FOR UPDATE;`);
      const startedAt = performance.now();

      const error: unknown = await postgres
        .transaction((client) => client.query(`SELECT id FROM ${table} WHERE id = 1 FOR UPDATE;`), {
          timeouts: LONG,
        })
        .catch((rejection: unknown) => rejection);

      expect(isDatabaseError(error) && error.code).toBe('55P03');
      expect(performance.now() - startedAt).toBeLessThan(2_000);
    } finally {
      await holding.query('ROLLBACK;');
      holding.release();
      await holder.close();
      await postgres.query(`DROP TABLE ${table};`);
    }
  });

  test('reject a profile that is not valid, without taking a client', async () => {
    const connect = vi.spyOn(postgres.pool, 'connect');
    const invalid = { statementTimeoutSeconds: 1, lockTimeoutSeconds: 2, queryTimeoutSeconds: 3 };

    await expectToRejectCode(
      postgres.transaction(() => Promise.resolve(), { timeouts: invalid }),
      ERRORS.INVALID_TIMEOUT_PROFILE,
    );
    expect(connect).not.toHaveBeenCalled();
    connect.mockRestore();
  });
});

/*
 * The client deadlines: the pool's query_timeout is 1 second, and the profile's statement timeout
 * is 3. Each sleep ends half a second away from every client deadline, so no outcome is a race.
 */
describe('client deadlines in a profiled transaction', { tags: ['full'] }, () => {
  test('a query outlives the pool client timeout only through withQueryTimeout', async () => {
    const withTimeout = await postgres.transaction(
      async (client) =>
        (await client.query(withQueryTimeout({ text: 'SELECT pg_sleep(1.5);' }, LONG))).rowCount,
      { timeouts: LONG },
    );

    await expect(
      postgres.transaction((client) => client.query('SELECT pg_sleep(1.5);'), { timeouts: LONG }),
    ).rejects.toThrow('Query read timeout');
    expect(withTimeout).toBe(1);
  });

  test('reuses the client when ROLLBACK confirms the connection after the client stopped waiting', async () => {
    let pid: number | undefined;

    await expect(
      postgres.transaction(
        async (client) => {
          pid = await readBackendPid(
            async (text) => (await client.query<{ pid: number }>(text)).rows,
          );
          return client.query('SELECT pg_sleep(1.5);');
        },
        { timeouts: LONG },
      ),
    ).rejects.toThrow('Query read timeout');

    expect(postgres.pool.totalCount).toBe(1);
    expect(await readBackendPid((text) => postgres.query(text))).toBe(pid);
    expect(onError).not.toHaveBeenCalled();
  });

  test('destroys the client when its statement outlasts the ROLLBACK too', async () => {
    let pid: number | undefined;

    await expect(
      postgres.transaction(
        async (client) => {
          pid = await readBackendPid(
            async (text) => (await client.query<{ pid: number }>(text)).rows,
          );
          return client.query('SELECT pg_sleep(2.5);');
        },
        { timeouts: LONG },
      ),
    ).rejects.toThrow('Query read timeout');

    expect(postgres.pool.totalCount).toBe(0);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Query read timeout' }),
    );
    expect(await readBackendPid((text) => postgres.query(text))).not.toBe(pid);
  });
});
