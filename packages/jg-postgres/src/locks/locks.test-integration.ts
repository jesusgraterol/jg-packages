import { setTimeout } from 'node:timers/promises';

import { expectToRejectCode } from 'jg-exception/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { isInTransaction } from '../transactions/index.js';
import { createAdvisoryLockKey, lockTransaction, withSessionLock } from './locks.js';

let postgres: IPostgres;
const onError = vi.fn();

beforeAll(() => {
  postgres = connectTestPostgres({ onError });
});

afterEach(() => {
  onError.mockClear();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

/**
 * Checks whether any session holds an advisory lock.
 * @param key The lock's key.
 * @returns A promise that resolves to whether it's held.
 */
const isLockHeld = async (key: string): Promise<boolean> => {
  const [row] = await postgres.query<{ held: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_locks
         WHERE locktype = 'advisory' AND granted
           AND ((classid::bigint << 32) | objid::bigint) = ($1::bigint & x'FFFFFFFFFFFFFFFF'::bigint)
     ) AS held;`,
    [key],
  );
  return row?.held === true;
};

describe('lockTransaction', () => {
  test('waits for the transaction holding the lock, and releases it at COMMIT', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    const order: string[] = [];
    let markHolding = (): void => undefined;
    const isHolding = new Promise<void>((resolve) => {
      markHolding = resolve;
    });
    const holder = postgres.transaction(async (client) => {
      await lockTransaction(client, key);
      order.push('first holds');
      markHolding();
      await setTimeout(300);
      order.push('first done');
    });
    // the second asks only once the first holds the lock, however long the first took to get it
    await isHolding;

    await postgres.transaction(async (client) => {
      await lockTransaction(client, key);
      order.push('second holds');
    });
    await holder;

    expect(order).toStrictEqual(['first holds', 'first done', 'second holds']);
    await expect(isLockHeld(key)).resolves.toBe(false);
  });
});

describe('withSessionLock', () => {
  test('runs the operation while holding the lock, then releases it and reuses the client', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);

    const outcome = await withSessionLock(postgres, key, async (lock) => {
      lock.assertActive();
      expect(lock.isActive()).toBe(true);
      await expect(isLockHeld(key)).resolves.toBe(true);
      await lock.client.query('SELECT 1;');
      return 'done';
    });

    expect(outcome).toStrictEqual({ acquired: true, result: 'done' });
    await expect(isLockHeld(key)).resolves.toBe(false);
    expect(onError).not.toHaveBeenCalled();
  });

  test('skips the operation when another session holds the lock', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    const operation = vi.fn();

    const outcome = await withSessionLock(postgres, key, async () =>
      withSessionLock(postgres, key, operation),
    );

    expect(outcome).toStrictEqual({ acquired: true, result: { acquired: false } });
    expect(operation).not.toHaveBeenCalled();
  });

  test("releases the lock when the operation throws, and rejects with the operation's error", async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    const operationError = new Error('deletion failed');

    await expect(withSessionLock(postgres, key, () => Promise.reject(operationError))).rejects.toBe(
      operationError,
    );
    await expect(isLockHeld(key)).resolves.toBe(false);
  });

  test('destroys the client the operation marks unsafe, which releases the lock', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    let releaseSpy: MockInstance | undefined;

    await withSessionLock(postgres, key, (lock) => {
      releaseSpy = vi.spyOn(lock.client, 'release');
      lock.destroyClient();
      return Promise.resolve();
    });

    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
    await vi.waitFor(async () => {
      await expect(isLockHeld(key)).resolves.toBe(false);
    });
  });

  test('reports SESSION_LOCK_LOST when the connection ends, and destroys the client', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    let releaseSpy: MockInstance | undefined;

    const outcome = withSessionLock(postgres, key, async (lock) => {
      releaseSpy = vi.spyOn(lock.client, 'release');
      // added after withSessionLock's own listener, so it runs once that one has seen the end
      let hasEnded = false;
      lock.client.on('end', () => {
        hasEnded = true;
      });
      const [row] = (await lock.client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;'))
        .rows;
      await postgres.query('SELECT pg_terminate_backend($1);', [row?.pid]);
      // both signs of the loss reach the lock: the error, which it reports, and the connection's
      // end, which carries no error and can come later
      await vi.waitFor(() => {
        expect(lock.isActive()).toBe(false);
        expect(onError).toHaveBeenCalled();
        expect(hasEnded).toBe(true);
      });
      lock.assertActive();
    });

    await expectToRejectCode(
      outcome,
      ERRORS.SESSION_LOCK_LOST,
      'The connection that held the session lock was lost.',
    );
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
    await expect(isLockHeld(key)).resolves.toBe(false);
  });

  test('reports to console.error for a database createPostgres did not create', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const unlockError = new Error('unlock unavailable');

    await withSessionLock({ ...postgres }, createAdvisoryLockKey('test:copy'), (lock) => {
      vi.spyOn(lock.client, 'query').mockRejectedValueOnce(unlockError);
      return Promise.resolve();
    });

    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(unlockError);
    expect(onError).not.toHaveBeenCalled();
  });

  test('destroys the client, and reports the error, when releasing the lock fails', async () => {
    const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
    const unlockError = new Error('unlock unavailable');
    let releaseSpy: MockInstance | undefined;

    await withSessionLock(postgres, key, (lock) => {
      releaseSpy = vi.spyOn(lock.client, 'release');
      vi.spyOn(lock.client, 'query').mockRejectedValueOnce(unlockError);
      return Promise.resolve();
    });

    expect(onError).toHaveBeenCalledExactlyOnceWith(unlockError);
    expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
    await vi.waitFor(async () => {
      await expect(isLockHeld(key)).resolves.toBe(false);
    });
  });

  describe('transaction', () => {
    const table = createTableName('lock_transactions');

    beforeAll(async () => {
      await postgres.query(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY);`);
    });

    beforeEach(async () => {
      await postgres.query(`DELETE FROM ${table};`);
    });

    /**
     * Lists the ids the table holds.
     * @returns A promise that resolves to the ids.
     */
    const readIds = async (): Promise<number[]> =>
      (await postgres.query<{ id: number }>(`SELECT id FROM ${table} ORDER BY id;`)).map(
        ({ id }) => id,
      );

    test("runs one transaction after another on the lock's client, holding the lock between them", async () => {
      const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
      let releaseSpy: MockInstance | undefined;

      const outcome = await withSessionLock(postgres, key, async (lock) => {
        releaseSpy = vi.spyOn(lock.client, 'release');
        await lock.transaction(async (client) => {
          expect(client).toBe(lock.client);
          await client.query(`INSERT INTO ${table} (id) VALUES (1);`);
        });
        expect(isInTransaction(lock.client)).toBe(false);
        await expect(isLockHeld(key)).resolves.toBe(true);
        return lock.transaction(async (client) => {
          await client.query(`INSERT INTO ${table} (id) VALUES (2);`);
          return 'both committed';
        });
      });

      expect(outcome).toStrictEqual({ acquired: true, result: 'both committed' });
      await expect(readIds()).resolves.toStrictEqual([1, 2]);
      await expect(isLockHeld(key)).resolves.toBe(false);
      expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(false);
    });

    test("refuses to begin once the lock's connection was lost", async () => {
      const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
      const operation = vi.fn();

      const outcome = withSessionLock(postgres, key, async (lock) => {
        const [row] = (await lock.client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;'))
          .rows;
        await postgres.query('SELECT pg_terminate_backend($1);', [row?.pid]);
        await vi.waitFor(() => {
          expect(lock.isActive()).toBe(false);
        });
        await lock.transaction(operation);
      });

      await expectToRejectCode(outcome, ERRORS.SESSION_LOCK_LOST);
      expect(operation).not.toHaveBeenCalled();
    });

    test('destroys the client when a transaction ends in an unknown state, which frees the lock without an unlock', async () => {
      const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
      const connectionError = new Error('Connection terminated unexpectedly');
      let releaseSpy: MockInstance | undefined;
      let querySpy: MockInstance | undefined;

      const outcome = withSessionLock(postgres, key, async (lock) => {
        releaseSpy = vi.spyOn(lock.client, 'release');
        const realQuery = lock.client.query.bind(lock.client) as (...args: unknown[]) => unknown;
        querySpy = vi
          .spyOn(lock.client, 'query')
          .mockImplementation((...args: unknown[]) =>
            args[0] === 'COMMIT' ? Promise.reject(connectionError) : realQuery(...args),
          );
        await lock.transaction(async (client) => {
          await client.query(`INSERT INTO ${table} (id) VALUES (10);`);
        });
      });

      await expectToRejectCode(outcome, ERRORS.TRANSACTION_OUTCOME_UNKNOWN);
      expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
      expect(querySpy).not.toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock($1::bigint) AS released;',
        [key],
      );
      await vi.waitFor(async () => {
        await expect(isLockHeld(key)).resolves.toBe(false);
      });
      // closing the connection rolled the transaction back
      await expect(readIds()).resolves.not.toContain(10);
    });

    test('destroys the client when the operation leaves its own transaction open', async () => {
      const key = createAdvisoryLockKey(`test:${crypto.randomUUID()}`);
      let releaseSpy: MockInstance | undefined;

      await withSessionLock(postgres, key, async (lock) => {
        releaseSpy = vi.spyOn(lock.client, 'release');
        await lock.client.query('BEGIN;');
        await lock.client.query(`INSERT INTO ${table} (id) VALUES (20);`);
      });

      expect(releaseSpy).toHaveBeenCalledExactlyOnceWith(true);
      await vi.waitFor(async () => {
        await expect(isLockHeld(key)).resolves.toBe(false);
      });
      await expect(readIds()).resolves.not.toContain(20);
    });
  });
});
