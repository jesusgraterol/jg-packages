import type { PoolClient } from 'pg';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import { assertTimeoutProfile, buildTransactionTimeoutsQuery } from '../timeouts/index.js';
import type { IRunTransactionOptions } from './types.js';
import { isCommitOutcomeUnknown, waitForReadyForQuery } from './utilities.js';

/*
 * The clients runTransaction has begun a transaction on that hasn't confirmably ended: marked
 * before BEGIN, and unmarked only once COMMIT or ROLLBACK is answered, so a client whose
 * transaction ended in an unknown state stays marked and isn't reused.
 */
const CLIENTS_IN_TRANSACTION = new WeakSet<PoolClient>();

/**
 * Checks whether a client is inside a transaction runTransaction began, including one whose end
 * is unknown, such as a COMMIT the server never answered or a ROLLBACK that failed. Release such a
 * client with `client.release(isInTransaction(client))`, which destroys it.
 * @param client The client.
 * @returns Whether the client is inside such a transaction.
 * @example
 * import { createPostgres, isInTransaction, runTransaction } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const client = await postgres.pool.connect();
 * try {
 *   await runTransaction(client, async (transactionClient) => {
 *     isInTransaction(transactionClient); // true
 *   });
 * } finally {
 *   client.release(isInTransaction(client));
 * }
 */
export const isInTransaction = (client: PoolClient): boolean => CLIENTS_IN_TRANSACTION.has(client);

/**
 * Runs an operation in a transaction on a client the caller already holds, such as a session
 * lock's, committing when it resolves and rolling back when it throws. It refuses a client that's
 * already in a transaction, and never releases the client: release it with
 * `client.release(isInTransaction(client))`, which destroys a client whose transaction ended in an
 * unknown state.
 * @param client The client, checked out of the pool by the caller.
 * @param operation The work, given the same client.
 * @param options The transaction's timeouts, and where a failed ROLLBACK goes.
 * @returns A promise that resolves to what the operation resolves to, once committed.
 * @example
 * import { createPostgres, isInTransaction, runTransaction } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const client = await postgres.pool.connect();
 * try {
 *   await runTransaction(client, async (transactionClient) => {
 *     await transactionClient.query('DELETE FROM user_session WHERE user_account_id = $1;', ['42']);
 *   });
 *   await runTransaction(client, async (transactionClient) => {
 *     await transactionClient.query('DELETE FROM user_account WHERE id = $1;', ['42']);
 *   });
 * } finally {
 *   client.release(isInTransaction(client));
 * }
 * @throws
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 * - TRANSACTION_ALREADY_ACTIVE: The client is already in a transaction, so another can't begin on it.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 */
export const runTransaction = async <T>(
  client: PoolClient,
  operation: (client: PoolClient) => Promise<T>,
  { timeouts, onError }: IRunTransactionOptions = {},
): Promise<T> => {
  if (timeouts !== undefined) {
    assertTimeoutProfile(timeouts);
  }
  const status = client.getTransactionStatus();
  if (CLIENTS_IN_TRANSACTION.has(client) || status === 'T' || status === 'E') {
    throw new Exception("The client is already in a transaction, so another can't begin on it.", {
      code: ERRORS.TRANSACTION_ALREADY_ACTIVE,
    });
  }
  const reportError = onError ?? ((error: unknown): void => console.error(error));
  // a checked-out client has no pool listener, so an error event would otherwise crash the process
  let hasLostConnection = false;
  const onConnectionLoss = (): void => {
    hasLostConnection = true;
  };
  client.on('error', onConnectionLoss);
  client.on('end', onConnectionLoss);
  // marked before BEGIN, so a BEGIN that fails without an answer leaves the client marked
  CLIENTS_IN_TRANSACTION.add(client);
  let isCommitting = false;
  try {
    await client.query('BEGIN');
    if (timeouts !== undefined) {
      await client.query(buildTransactionTimeoutsQuery(timeouts));
    }
    const result = await operation(client);
    isCommitting = true;
    await client.query('COMMIT');
    CLIENTS_IN_TRANSACTION.delete(client);
    return result;
  } catch (error) {
    if (isCommitting) {
      if (isCommitOutcomeUnknown(error, hasLostConnection)) {
        throw new Exception(
          'The connection was lost during COMMIT, so the transaction may or may not have committed.',
          { code: ERRORS.TRANSACTION_OUTCOME_UNKNOWN, cause: error },
        );
      }
      // the server answered, so it rolled the transaction back and the connection is reusable,
      // once the client has read that it's idle again
      await waitForReadyForQuery(client);
      CLIENTS_IN_TRANSACTION.delete(client);
      throw error;
    }
    try {
      await client.query('ROLLBACK');
      CLIENTS_IN_TRANSACTION.delete(client);
    } catch (rollbackError) {
      reportError(rollbackError);
    }
    throw error;
  } finally {
    client.off('error', onConnectionLoss);
    client.off('end', onConnectionLoss);
  }
};
