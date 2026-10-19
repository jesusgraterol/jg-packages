import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import { assertTimeoutProfile } from '../timeouts/index.js';
import { isInTransaction, runTransaction } from '../transactions/index.js';
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
    // checked before connecting, so an invalid profile never checks out a client
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
    try {
      return await runTransaction(client, operation, { timeouts, onError: reportError });
    } finally {
      client.off('error', onClientError);
      // the client goes back to the pool only when its connection is known to be idle and healthy
      client.release(hasLostConnection || isInTransaction(client));
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
