import type { PoolClient } from 'pg';

import { isDatabaseError } from '../database-errors/index.js';

/**
 * Checks whether a failed COMMIT may still have committed: the server never answered, because the
 * connection broke or the server is shutting down, so nobody can tell.
 * @param error The error COMMIT failed with.
 * @param hasLostConnection Whether the client reported a connection error meanwhile.
 * @returns Whether the transaction's outcome is unknown.
 */
export const isCommitOutcomeUnknown = (error: unknown, hasLostConnection: boolean): boolean =>
  hasLostConnection ||
  !isDatabaseError(error) ||
  error.code === undefined ||
  error.code.startsWith('08') ||
  error.code.startsWith('57P');

/**
 * Waits until the client has read the transaction status that follows a failed query.
 * node-postgres rejects a query as soon as the server's error arrives, before it reads the
 * ReadyForQuery message after it, so right after a COMMIT the server refused, the client's status
 * can still say it's in a transaction. The wait ends at that message, or when the connection ends.
 * @param client The client whose query failed.
 * @returns A promise that resolves once the client's transaction status is current.
 */
export const waitForReadyForQuery = async (client: PoolClient): Promise<void> => {
  if (client.getTransactionStatus() === 'I') {
    return;
  }
  await new Promise<void>((resolve) => {
    const finish = (): void => {
      client.off('drain', finish);
      client.off('end', finish);
      client.off('error', finish);
      resolve();
    };
    client.on('drain', finish);
    client.on('end', finish);
    client.on('error', finish);
  });
};
