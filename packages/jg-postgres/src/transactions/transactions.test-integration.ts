import type { PoolClient } from 'pg';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { isForeignKeyViolationError } from '../database-errors/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { defineTimeoutProfile } from '../timeouts/index.js';
import { isInTransaction, runTransaction } from './transactions.js';

const ALREADY_ACTIVE_MESSAGE =
  "The client is already in a transaction, so another can't begin on it.";

let postgres: IPostgres;
const parentTable = createTableName('held_parent');
const childTable = createTableName('held_child');
let client: PoolClient;

beforeAll(async () => {
  postgres = connectTestPostgres();
  await postgres.query(`
    CREATE TABLE ${parentTable} (id INTEGER PRIMARY KEY);
    CREATE TABLE ${childTable} (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER NULL,
      CONSTRAINT fk_${childTable}__parent_id FOREIGN KEY (parent_id)
        REFERENCES ${parentTable} (id) DEFERRABLE INITIALLY DEFERRED
    );
  `);
});

beforeEach(async () => {
  await postgres.query(`DELETE FROM ${childTable}; DELETE FROM ${parentTable};`);
  client = await postgres.pool.connect();
});

afterEach(() => {
  vi.restoreAllMocks();
  // a client whose transaction ended in an unknown state is destroyed, as the rule says
  client.release(isInTransaction(client));
});

afterAll(async () => {
  await postgres.close();
});

/**
 * Lists the ids the child table holds.
 * @returns A promise that resolves to the ids.
 */
const readChildIds = async (): Promise<number[]> =>
  (await postgres.query<{ id: number }>(`SELECT id FROM ${childTable} ORDER BY id;`)).map(
    ({ id }) => id,
  );

/**
 * Makes one statement fail on the client, without sending it, and lets every other through.
 * @param statement The statement to fail, such as `COMMIT`.
 * @param error What it fails with.
 */
const failStatement = (statement: string, error: Error): void => {
  const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
  vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) =>
    args[0] === statement ? Promise.reject(error) : realQuery(...args),
  );
};

describe('runTransaction', () => {
  test('commits, resolves to what the operation resolves to, and tracks the transaction only inside it', async () => {
    const releaseSpy = vi.spyOn(client, 'release');
    expect(isInTransaction(client)).toBe(false);

    const result = await runTransaction(client, async (transactionClient) => {
      expect(transactionClient).toBe(client);
      expect(isInTransaction(client)).toBe(true);
      await transactionClient.query(`INSERT INTO ${childTable} (id) VALUES (1);`);
      return 'committed';
    });

    expect(result).toBe('committed');
    expect(isInTransaction(client)).toBe(false);
    expect(client.getTransactionStatus()).toBe('I');
    await expect(readChildIds()).resolves.toStrictEqual([1]);
    // the caller still holds the client
    expect(releaseSpy).not.toHaveBeenCalled();
  });

  test("rolls back an operation's failure, rejects with the same error, and leaves the client reusable", async () => {
    const operationError = new Error('deletion failed');

    await expect(
      runTransaction(client, async (transactionClient) => {
        await transactionClient.query(`INSERT INTO ${childTable} (id) VALUES (1);`);
        expect(isInTransaction(client)).toBe(true);
        throw operationError;
      }),
    ).rejects.toBe(operationError);

    expect(isInTransaction(client)).toBe(false);
    expect(client.getTransactionStatus()).toBe('I');
    await expect(readChildIds()).resolves.toStrictEqual([]);
    await expect(client.query('SELECT 1 AS one;')).resolves.toMatchObject({ rows: [{ one: 1 }] });
  });

  test("rejects with the server's COMMIT error, such as a deferred foreign key, and leaves the client unmarked and reusable", async () => {
    const error = await runTransaction(client, async (transactionClient) => {
      await transactionClient.query(`INSERT INTO ${childTable} (id, parent_id) VALUES (1, 99);`);
    }).catch((cause: unknown) => cause);

    expect(isForeignKeyViolationError(error, `fk_${childTable}__parent_id`)).toBe(true);
    expect(isInTransaction(client)).toBe(false);
    expect(client.getTransactionStatus()).toBe('I');
    await expect(readChildIds()).resolves.toStrictEqual([]);
    await expect(client.query('SELECT 1 AS one;')).resolves.toMatchObject({ rows: [{ one: 1 }] });
  });

  test('runs one transaction after another on the same client', async () => {
    await runTransaction(client, async (transactionClient) => {
      await transactionClient.query(`INSERT INTO ${parentTable} (id) VALUES (1);`);
    });
    await runTransaction(client, async (transactionClient) => {
      await transactionClient.query(`INSERT INTO ${childTable} (id, parent_id) VALUES (1, 1);`);
    });

    await expect(readChildIds()).resolves.toStrictEqual([1]);
    expect(isInTransaction(client)).toBe(false);
  });

  test('refuses a nested call without a query, while the outer transaction still commits', async () => {
    const innerOperation = vi.fn();

    await runTransaction(client, async (transactionClient) => {
      await transactionClient.query(`INSERT INTO ${childTable} (id) VALUES (1);`);
      const querySpy = vi.spyOn(client, 'query');
      await expectToRejectCode(
        runTransaction(transactionClient, innerOperation),
        ERRORS.TRANSACTION_ALREADY_ACTIVE,
        ALREADY_ACTIVE_MESSAGE,
      );
      expect(querySpy).not.toHaveBeenCalled();
      querySpy.mockRestore();
    });

    expect(innerOperation).not.toHaveBeenCalled();
    await expect(readChildIds()).resolves.toStrictEqual([1]);
    expect(isInTransaction(client)).toBe(false);
  });

  test.each([
    ['a BEGIN the caller sent', ['BEGIN;']],
    ['a transaction a failed statement aborted', ['BEGIN;', 'SELECT 1 / 0;']],
  ])('refuses %s without a query', async (_description, statements) => {
    for (const statement of statements) {
      await client.query(statement).catch(() => undefined);
    }
    const querySpy = vi.spyOn(client, 'query');
    const operation = vi.fn();

    await expectToRejectCode(
      runTransaction(client, operation),
      ERRORS.TRANSACTION_ALREADY_ACTIVE,
      ALREADY_ACTIVE_MESSAGE,
    );

    expect(querySpy).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
    // the caller's own transaction is untouched, and theirs to end
    expect(client.getTransactionStatus()).not.toBe('I');
    querySpy.mockRestore();
    await client.query('ROLLBACK;');
  });

  test("sets the profile's timeouts for the transaction only", async () => {
    const timeouts = defineTimeoutProfile({ statementTimeoutSeconds: 7, lockTimeoutSeconds: 3 });
    const before = (await client.query<{ statement_timeout: string }>('SHOW statement_timeout;'))
      .rows[0];

    const inside = await runTransaction(
      client,
      async (transactionClient) => {
        const statement = await transactionClient.query<{ statement_timeout: string }>(
          'SHOW statement_timeout;',
        );
        const lock = await transactionClient.query<{ lock_timeout: string }>('SHOW lock_timeout;');
        return [statement.rows[0]?.statement_timeout, lock.rows[0]?.lock_timeout];
      },
      { timeouts },
    );

    expect(inside).toStrictEqual(['7s', '3s']);
    const after = (await client.query<{ statement_timeout: string }>('SHOW statement_timeout;'))
      .rows[0];
    expect(after).toStrictEqual(before);
  });

  test('refuses an invalid timeout profile before any query', async () => {
    const querySpy = vi.spyOn(client, 'query');
    const operation = vi.fn();

    await expectToRejectCode(
      runTransaction(client, operation, {
        timeouts: { statementTimeoutSeconds: 1, lockTimeoutSeconds: 5, queryTimeoutSeconds: 16 },
      }),
      ERRORS.INVALID_TIMEOUT_PROFILE,
    );

    expect(querySpy).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
    expect(isInTransaction(client)).toBe(false);
  });

  test('treats a COMMIT that fails without an answer as an unknown outcome, and keeps the client marked', async () => {
    const connectionError = new Error('Connection terminated unexpectedly');
    failStatement('COMMIT', connectionError);

    const error = await runTransaction(client, () => Promise.resolve('done')).catch(
      (cause: unknown) => cause,
    );

    expect(error).toMatchObject({
      code: ERRORS.TRANSACTION_OUTCOME_UNKNOWN,
      cause: connectionError,
    });
    expect(isInTransaction(client)).toBe(true);
    // the marked client is refused, so it can't be reused before it's destroyed
    await expectToRejectCode(
      runTransaction(client, () => Promise.resolve()),
      ERRORS.TRANSACTION_ALREADY_ACTIVE,
    );
  });

  test('treats a connection lost during the operation as an unknown COMMIT outcome, without crashing the process', async () => {
    const error = await runTransaction(client, async (transactionClient) => {
      // added after runTransaction's own listener, the only error listener the client has
      let hasEnded = false;
      transactionClient.on('end', () => {
        hasEnded = true;
      });
      const [row] = (
        await transactionClient.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;')
      ).rows;
      await postgres.query('SELECT pg_terminate_backend($1);', [row?.pid]);
      await vi.waitFor(() => {
        expect(hasEnded).toBe(true);
      });
    }).catch((cause: unknown) => cause);

    expect(error).toMatchObject({ code: ERRORS.TRANSACTION_OUTCOME_UNKNOWN });
    expect(isInTransaction(client)).toBe(true);
  });

  test("reports a failed ROLLBACK to onError, rejects with the operation's error, and keeps the client marked", async () => {
    const operationError = new Error('deletion failed');
    const rollbackError = new Error('rollback unavailable');
    const onError = vi.fn();
    failStatement('ROLLBACK', rollbackError);

    await expect(
      runTransaction(client, () => Promise.reject(operationError), { onError }),
    ).rejects.toBe(operationError);

    expect(onError).toHaveBeenCalledExactlyOnceWith(rollbackError);
    expect(isInTransaction(client)).toBe(true);
  });

  test('reports a failed ROLLBACK to console.error without an onError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rollbackError = new Error('rollback unavailable');
    failStatement('ROLLBACK', rollbackError);

    await expect(
      runTransaction(client, () => Promise.reject(new Error('deletion failed'))),
    ).rejects.toThrow('deletion failed');

    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(rollbackError);
  });

  test('never runs the operation when BEGIN fails, and unmarks the client once ROLLBACK confirms it', async () => {
    const beginError = new Error('begin response lost');
    failStatement('BEGIN', beginError);
    const operation = vi.fn();

    await expect(runTransaction(client, operation)).rejects.toBe(beginError);

    expect(operation).not.toHaveBeenCalled();
    expect(isInTransaction(client)).toBe(false);
    expect(client.getTransactionStatus()).toBe('I');
  });

  test("keeps the client marked when BEGIN fails and ROLLBACK can't confirm its state", async () => {
    const beginError = new Error('begin response lost');
    vi.spyOn(client, 'query')
      .mockRejectedValueOnce(beginError)
      .mockRejectedValueOnce(new Error('rollback unavailable'));
    const operation = vi.fn();

    await expect(runTransaction(client, operation, { onError: vi.fn() })).rejects.toBe(beginError);

    expect(operation).not.toHaveBeenCalled();
    expect(isInTransaction(client)).toBe(true);
  });

  test('removes its listeners once it ends', async () => {
    const errorListeners = client.listenerCount('error');
    const endListeners = client.listenerCount('end');

    await runTransaction(client, () => {
      expect(client.listenerCount('error')).toBe(errorListeners + 1);
      expect(client.listenerCount('end')).toBe(endListeners + 1);
      return Promise.resolve();
    });

    expect(client.listenerCount('error')).toBe(errorListeners);
    expect(client.listenerCount('end')).toBe(endListeners);
  });
});
