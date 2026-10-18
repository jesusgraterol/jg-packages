import { setTimeout } from 'node:timers/promises';

import { expectToRejectCode } from 'jg-exception/testing';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres } from '../test-utils/database.js';
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
    const holder = postgres.transaction(async (client) => {
      await lockTransaction(client, key);
      order.push('first holds');
      await setTimeout(300);
      order.push('first done');
    });
    await setTimeout(100);

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
      const [row] = (await lock.client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid;'))
        .rows;
      await postgres.query('SELECT pg_terminate_backend($1);', [row?.pid]);
      await vi.waitFor(() => {
        expect(lock.isActive()).toBe(false);
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
});
