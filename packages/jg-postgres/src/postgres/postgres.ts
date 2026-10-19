import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { Exception } from 'jg-exception';

import { isDatabaseError } from '../database-errors/index.js';
import { ERRORS } from '../shared/index.js';
import { assertTimeoutProfile, buildTransactionTimeoutsQuery } from '../timeouts/index.js';
import { POOL_TYPES } from './parsers.js';
import type { IPostgres, IPostgresConfig, ITransactionOptions } from './types.js';

// each database's onError, which the package's own helpers, such as withSessionLock, report to
const ERROR_REPORTERS = new WeakMap<IPostgres, (error: unknown) => void>();

/**
 * Reads where a database's helpers report errors no caller awaits.
 * @param postgres The database, from createPostgres.
 * @returns Its onError, or console.error.
 */
export const getErrorReporter = (postgres: IPostgres): ((error: unknown) => void) =>
  ERROR_REPORTERS.get(postgres) ?? ((error: unknown): void => console.error(error));

/**
 * Checks whether a failed COMMIT may still have committed: the server never answered, because the
 * connection broke or the server is shutting down, so nobody can tell.
 * @param error The error COMMIT failed with.
 * @param hasLostConnection Whether the client reported a connection error meanwhile.
 * @returns Whether the transaction's outcome is unknown.
 */
const isCommitOutcomeUnknown = (error: unknown, hasLostConnection: boolean): boolean =>
  hasLostConnection ||
  !isDatabaseError(error) ||
  error.code === undefined ||
  error.code.startsWith('08') ||
  error.code.startsWith('57P');

/**
 * Creates a PostgreSQL pool with the helpers every query, transaction, and lock uses. The pool
 * parses NUMERIC as a number and TIMESTAMPTZ as an ISO 8601 UTC string, keeps BIGINT as a
 * string, and sends errors no caller awaits, such as an idle connection the server closed, to
 * onError instead of crashing the process.
 * @param config node-postgres's pool configuration, plus onError.
 * @returns The pool and its helpers.
 * @example
 * import { createPostgres } from 'jg-postgres';
 *
 * const postgres = createPostgres({
 *   host: 'localhost',
 *   database: 'app',
 *   user: 'app',
 *   password: 'secret',
 *   max: 10,
 *   connectionTimeoutMillis: 30_000,
 *   statement_timeout: 60_000,
 *   lock_timeout: 30_000,
 *   idle_in_transaction_session_timeout: 300_000,
 * });
 *
 * const users = await postgres.query<{ id: string }>('SELECT id FROM user_account LIMIT $1;', [10]);
 * await postgres.close();
 */
export const createPostgres = ({ onError, ...poolConfig }: IPostgresConfig): IPostgres => {
  const reportError = onError ?? ((error: unknown): void => console.error(error));
  const pool = new Pool({ ...poolConfig, types: POOL_TYPES });
  pool.on('error', reportError);

  /**
   * Runs an operation in a transaction on one client, with the profile's statement and lock
   * timeouts set for that transaction only when options.timeouts is given.
   * @param operation The work, given the transaction's client.
   * @param options The transaction's timeouts.
   * @returns A promise that resolves to what the operation resolves to, once committed.
   * @throws
   * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
   * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
   */
  const transaction = async <T>(
    operation: (client: PoolClient) => Promise<T>,
    { timeouts }: ITransactionOptions = {},
  ): Promise<T> => {
    if (timeouts !== undefined) {
      assertTimeoutProfile(timeouts);
    }
    const client = await pool.connect();
    let hasLostConnection = false;
    const onClientError = (error: Error): void => {
      hasLostConnection = true;
      reportError(error);
    };
    client.on('error', onClientError);
    // the client goes back to the pool only when its connection is known to be idle and healthy
    let shouldDestroyClient = true;
    let isCommitting = false;
    try {
      await client.query('BEGIN');
      if (timeouts !== undefined) {
        await client.query(buildTransactionTimeoutsQuery(timeouts));
      }
      const result = await operation(client);
      isCommitting = true;
      await client.query('COMMIT');
      shouldDestroyClient = hasLostConnection;
      return result;
    } catch (error) {
      if (isCommitting) {
        if (isCommitOutcomeUnknown(error, hasLostConnection)) {
          throw new Exception(
            'The connection was lost during COMMIT, so the transaction may or may not have committed.',
            { code: ERRORS.TRANSACTION_OUTCOME_UNKNOWN, cause: error },
          );
        }
        // the server answered, so it rolled the transaction back and the connection is reusable
        shouldDestroyClient = hasLostConnection;
        throw error;
      }
      try {
        await client.query('ROLLBACK');
        shouldDestroyClient = hasLostConnection;
      } catch (rollbackError) {
        reportError(rollbackError);
      }
      throw error;
    } finally {
      client.off('error', onClientError);
      client.release(shouldDestroyClient);
    }
  };

  const postgres: IPostgres = {
    pool,
    query: async <T extends QueryResultRow = QueryResultRow>(
      text: string,
      params?: readonly unknown[],
    ): Promise<T[]> => (await pool.query<T>(text, params as unknown[] | undefined)).rows,
    transaction,
    close: async (): Promise<void> => {
      await pool.end();
    },
  };
  ERROR_REPORTERS.set(postgres, reportError);
  return postgres;
};
