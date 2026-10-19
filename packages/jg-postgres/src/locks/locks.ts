import { createHash } from 'node:crypto';

import type { PoolClient } from 'pg';

import { Exception } from 'jg-exception';

import { getErrorReporter } from '../postgres/postgres.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { isInTransaction, runTransaction } from '../transactions/index.js';
import type { ISessionLock, ISessionLockResult } from './types.js';

/**
 * Turns a lock's name into the signed 64-bit key PostgreSQL's advisory locks take: the first 8
 * bytes of the name's SHA-256 hash. The same name always gives the same key, in every process.
 * @param name The lock's name, such as `user-account-deletion:42`.
 * @returns The key, as a string, such as `'7480330268761432310'`.
 * @example
 * import { createAdvisoryLockKey } from 'jg-postgres';
 *
 * createAdvisoryLockKey('moldea'); // => '7480330268761432310'
 */
export const createAdvisoryLockKey = (name: string): string =>
  createHash('sha256').update(name).digest().readBigInt64BE(0).toString();

/**
 * Takes an advisory lock for the rest of a transaction, waiting while another transaction holds
 * it. PostgreSQL releases it when the transaction commits or rolls back.
 * @param client The transaction's client.
 * @param key The lock's key, from createAdvisoryLockKey.
 * @returns A promise that resolves once the lock is held.
 * @example
 * import { createAdvisoryLockKey, createPostgres, lockTransaction } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * await postgres.transaction(async (client) => {
 *   await lockTransaction(client, createAdvisoryLockKey('invoice-numbers'));
 *   // only one transaction at a time gets here
 * });
 */
export const lockTransaction = async (client: PoolClient, key: string): Promise<void> => {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint);', [key]);
};

/**
 * Runs an operation while holding an advisory lock on one connection, across as many
 * transactions as it needs, run with the lock's transaction, or skips it when another session
 * holds the lock. The lock lasts as long as its connection, so the operation can check it's still
 * held. Afterwards the lock is released, and the client is destroyed instead of reused when the
 * release fails, the connection was lost, or a transaction on it is still open or ended in an
 * unknown state, which releases the lock too.
 * @param postgres The database, from createPostgres.
 * @param key The lock's key, from createAdvisoryLockKey.
 * @param operation The work, given the lock.
 * @returns A promise that resolves to `{ acquired: false }` when another session holds the lock,
 * or `{ acquired: true, result }` with what the operation resolved to.
 * @example
 * import { createAdvisoryLockKey, createPostgres, withSessionLock } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const outcome = await withSessionLock(
 *   postgres,
 *   createAdvisoryLockKey('user-account-deletion:42'),
 *   async (lock) => {
 *     await lock.transaction(async (client) => {
 *       await client.query('DELETE FROM user_session WHERE user_account_id = $1;', ['42']);
 *     });
 *     lock.assertActive();
 *     return 'deleted';
 *   },
 * );
 * if (!outcome.acquired) {
 *   // another request is already deleting the account
 * }
 * @throws
 * - SESSION_LOCK_LOST: The connection that held the session lock was lost.
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 * - TRANSACTION_ALREADY_ACTIVE: The client is already in a transaction, so another can't begin on it.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 */
export const withSessionLock = async <T>(
  postgres: IPostgres,
  key: string,
  operation: (lock: ISessionLock) => Promise<T>,
): Promise<ISessionLockResult<T>> => {
  const reportError = getErrorReporter(postgres);
  const client = await postgres.pool.connect();
  let hasLostConnection = false;
  let isHeld = false;
  let shouldDestroyClient = false;
  const onConnectionLoss = (error?: Error): void => {
    hasLostConnection = true;
    if (error !== undefined) {
      reportError(error);
    }
  };
  const assertActive = (): void => {
    if (hasLostConnection) {
      throw new Exception('The connection that held the session lock was lost.', {
        code: ERRORS.SESSION_LOCK_LOST,
      });
    }
  };
  client.on('error', onConnectionLoss);
  client.on('end', onConnectionLoss);
  try {
    const { rows } = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1::bigint) AS acquired;',
      [key],
    );
    assertActive();
    isHeld = rows[0]?.acquired === true;
    if (!isHeld) {
      return { acquired: false };
    }
    const result = await operation({
      client,
      isActive: () => !hasLostConnection,
      assertActive,
      destroyClient: () => {
        shouldDestroyClient = true;
      },
      transaction: async (transactionOperation, options) => {
        assertActive();
        return runTransaction(client, transactionOperation, { ...options, onError: reportError });
      },
    });
    return { acquired: true, result };
  } catch (error) {
    // a failed query can leave the connection in any state, so it isn't reused
    shouldDestroyClient = shouldDestroyClient || !isHeld;
    throw error;
  } finally {
    // a transaction still open, or one whose end is unknown, must not reach the pool, and closing
    // its connection releases the lock without an unlock that would run inside it
    if (isInTransaction(client) || client.getTransactionStatus() !== 'I') {
      shouldDestroyClient = true;
    }
    if (isHeld && !hasLostConnection && !shouldDestroyClient) {
      try {
        const { rows } = await client.query<{ released: boolean }>(
          'SELECT pg_advisory_unlock($1::bigint) AS released;',
          [key],
        );
        shouldDestroyClient = rows[0]?.released !== true;
      } catch (unlockError) {
        reportError(unlockError);
        shouldDestroyClient = true;
      }
    }
    client.off('error', onConnectionLoss);
    client.off('end', onConnectionLoss);
    client.release(shouldDestroyClient || hasLostConnection);
  }
};
