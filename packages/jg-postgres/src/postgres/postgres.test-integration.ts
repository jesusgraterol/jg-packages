import { setTimeout } from 'node:timers/promises';

import { Pool, type PoolClient } from 'pg';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { inject } from 'vitest';

import { isDatabaseError, isUniqueViolationError } from '../database-errors/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import type { IPostgres } from './types.js';

let postgres: IPostgres;
const onError = vi.fn();

beforeAll(() => {
  postgres = connectTestPostgres({ onError });
});

beforeEach(() => {
  onError.mockClear();
});

afterEach(() => {
  // the pool reuses clients, so a spy on one must never outlive its test
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

describe('value parsing', () => {
  const table = createTableName('data_types');

  beforeAll(async () => {
    await postgres.query(`
      CREATE TABLE ${table} (
        id INTEGER PRIMARY KEY,
        bigint_value BIGINT NOT NULL,
        numeric_value NUMERIC(18, 4) NOT NULL,
        timestamptz_value TIMESTAMPTZ NOT NULL,
        jsonb_value JSONB NOT NULL,
        boolean_value BOOLEAN NOT NULL,
        text_value TEXT NOT NULL,
        nullable_value TEXT NULL
      );
    `);
    await postgres.query(`INSERT INTO ${table} VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`, [
      1,
      9_223_372_036_854_775_807n,
      1234567890.1234,
      '2026-04-12T21:34:18.573Z',
      { nested: { count: 2 }, tags: ['alpha'] },
      true,
      'text',
      null,
    ]);
  });

  test('reads NUMERIC as a number, TIMESTAMPTZ as an ISO string, and BIGINT as a string', async () => {
    await expect(postgres.query(`SELECT * FROM ${table};`)).resolves.toStrictEqual([
      {
        id: 1,
        bigint_value: '9223372036854775807',
        numeric_value: 1234567890.1234,
        timestamptz_value: '2026-04-12T21:34:18.573Z',
        jsonb_value: { nested: { count: 2 }, tags: ['alpha'] },
        boolean_value: true,
        text_value: 'text',
        nullable_value: null,
      },
    ]);
  });

  test("sets its parsers on its own pool, leaving node-postgres's for other pools", async () => {
    const plainPool = new Pool({ ...inject('postgres'), max: 1 });
    try {
      const { rows } = await plainPool.query(
        `SELECT numeric_value, timestamptz_value FROM ${table};`,
      );

      expect(rows[0]).toStrictEqual({
        numeric_value: '1234567890.1234',
        timestamptz_value: new Date('2026-04-12T21:34:18.573Z'),
      });
    } finally {
      await plainPool.end();
    }
  });

  test('rejects with the database error a query fails with', async () => {
    const error = await postgres
      .query('SELECT * FROM missing_table;')
      .catch((cause: unknown) => cause);

    expect(isDatabaseError(error)).toBe(true);
    expect(error).toMatchObject({ code: '42P01' });
  });
});

/**
 * Hands the next transaction a real client the test can watch.
 * @returns A promise that resolves to the client.
 */
const interceptTransactionClient = async (): Promise<PoolClient> => {
  const client = await postgres.pool.connect();
  vi.spyOn(postgres.pool, 'connect').mockResolvedValueOnce(client as never);
  return client;
};

describe('transaction', () => {
  const table = createTableName('transactions');

  /**
   * Lists the ids the table holds.
   * @returns A promise that resolves to the ids.
   */
  const readIds = async (): Promise<number[]> =>
    (await postgres.query<{ id: number }>(`SELECT id FROM ${table} ORDER BY id;`)).map(
      ({ id }) => id,
    );

  const interceptNextClient = interceptTransactionClient;

  beforeAll(async () => {
    await postgres.query(`
      CREATE TABLE ${table} (
        id INTEGER PRIMARY KEY,
        code INTEGER NULL,
        CONSTRAINT uq_${table}__code UNIQUE (code) DEFERRABLE INITIALLY DEFERRED
      );
    `);
  });

  beforeEach(async () => {
    await postgres.query(`DELETE FROM ${table};`);
  });

  test('commits the writes and resolves to what the operation resolves to', async () => {
    await expect(
      postgres.transaction(async (client) => {
        await client.query(`INSERT INTO ${table} (id) VALUES (1);`);
        return 'committed';
      }),
    ).resolves.toBe('committed');
    await expect(readIds()).resolves.toStrictEqual([1]);
  });

  test("rolls back an operation's failure and rejects with the same error", async () => {
    const operationError = new Error('transaction callback failed');

    await expect(
      postgres.transaction(async (client) => {
        await client.query(`INSERT INTO ${table} (id) VALUES (1);`);
        throw operationError;
      }),
    ).rejects.toBe(operationError);
    await expect(readIds()).resolves.toStrictEqual([]);
  });

  test('destroys the client and skips the operation when BEGIN fails on a broken connection', async () => {
    const client = await interceptNextClient();
    const beginError = new Error('begin response lost');
    vi.spyOn(client, 'query')
      .mockRejectedValueOnce(beginError)
      .mockRejectedValueOnce(new Error('rollback unavailable'));
    const releaseSpy = vi.spyOn(client, 'release');
    const operation = vi.fn();

    await expect(postgres.transaction(operation)).rejects.toBe(beginError);
    expect(operation).not.toHaveBeenCalled();
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('destroys the client, and reports the rollback error, when ROLLBACK fails', async () => {
    const client = await interceptNextClient();
    const operationError = new Error('transaction callback failed');
    const rollbackError = new Error('rollback unavailable');
    const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
    vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) =>
      args[0] === 'ROLLBACK' ? Promise.reject(rollbackError) : realQuery(...args),
    );
    const releaseSpy = vi.spyOn(client, 'release');

    await expect(postgres.transaction(() => Promise.reject(operationError))).rejects.toBe(
      operationError,
    );
    expect(onError).toHaveBeenCalledExactlyOnceWith(rollbackError);
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
  });

  test("rejects with the server's COMMIT error, without running the operation again, and reuses the client", async () => {
    const client = await interceptNextClient();
    const releaseSpy = vi.spyOn(client, 'release');
    const operation = vi.fn(async (transactionClient: PoolClient) => {
      await transactionClient.query(`INSERT INTO ${table} (id, code) VALUES (1, 7), (2, 7);`);
    });

    const error = await postgres.transaction(operation).catch((cause: unknown) => cause);

    expect(isUniqueViolationError(error, `uq_${table}__code`)).toBe(true);
    expect(operation).toHaveBeenCalledOnce();
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(false);
    await expect(readIds()).resolves.toStrictEqual([]);
  });

  test('treats a COMMIT that fails without a server answer as an unknown outcome, and destroys the client', async () => {
    const client = await interceptNextClient();
    const connectionError = new Error('Connection terminated unexpectedly');
    const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
    vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) =>
      args[0] === 'COMMIT' ? Promise.reject(connectionError) : realQuery(...args),
    );
    const releaseSpy = vi.spyOn(client, 'release');

    const error = await postgres
      .transaction(() => Promise.resolve('done'))
      .catch((cause: unknown) => cause);

    expect(error).toMatchObject({
      code: ERRORS.TRANSACTION_OUTCOME_UNKNOWN,
      cause: connectionError,
    });
    // destroying the client closed its connection, which rolled the transaction back
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('rejects with TRANSACTION_OUTCOME_UNKNOWN when the connection drops during COMMIT', async () => {
    // a deferred trigger keeps COMMIT busy long enough to end its connection midway
    const slowCommit = `${table}_slow_commit`;
    await postgres.query(`
      CREATE FUNCTION ${slowCommit}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_sleep(5); RETURN NULL; END
      $$;
      CREATE CONSTRAINT TRIGGER ${slowCommit} AFTER INSERT ON ${table}
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${slowCommit}();
    `);
    try {
      const outcome = postgres.transaction(async (client) => {
        const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;');
        await client.query(`INSERT INTO ${table} (id) VALUES (1);`);
        void setTimeout(500).then(() =>
          postgres.query('SELECT pg_terminate_backend($1);', [rows[0]?.pid]),
        );
      });

      await expectToRejectCode(
        outcome,
        ERRORS.TRANSACTION_OUTCOME_UNKNOWN,
        'The connection was lost during COMMIT, so the transaction may or may not have committed.',
      );
      // the server ended the connection while COMMIT ran its deferred trigger
      await expect(
        outcome.catch((error: unknown) => (error as Error).cause),
      ).resolves.toMatchObject({ code: '57P01' });
    } finally {
      await postgres.query(
        `DROP TRIGGER ${slowCommit} ON ${table}; DROP FUNCTION ${slowCommit}();`,
      );
    }
  });
});

describe('the error listeners', () => {
  test("report a transaction's lost connection, and destroy its client", async () => {
    const client = await interceptTransactionClient();
    const releaseSpy = vi.spyOn(client, 'release');

    const error = await postgres
      .transaction(async (transactionClient) => {
        const { rows } = await transactionClient.query<{ pid: number }>(
          'SELECT pg_backend_pid() AS pid;',
        );
        await postgres.query('SELECT pg_terminate_backend($1);', [rows[0]?.pid]);
        await vi.waitFor(() => {
          expect(onError).toHaveBeenCalled();
        });
        await transactionClient.query('SELECT 1;');
      })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(Error);
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
  });

  test('send errors to console.error without an onError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const quiet = connectTestPostgres({ onError: undefined });
    try {
      const [row] = await quiet.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;');
      await postgres.query('SELECT pg_terminate_backend($1);', [row?.pid]);
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
    } finally {
      await quiet.close();
    }
  });

  test('report an idle connection the server ended, instead of crashing the process', async () => {
    const { pid } =
      (await postgres.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;'))[0] ?? {};
    const other = connectTestPostgres();
    try {
      await other.query('SELECT pg_terminate_backend($1);', [pid]);
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    } finally {
      await other.close();
    }
    await expect(postgres.query('SELECT 1 AS one;')).resolves.toStrictEqual([{ one: 1 }]);
  });
});
