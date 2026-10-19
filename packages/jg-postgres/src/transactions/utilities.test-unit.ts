import { EventEmitter } from 'node:events';

import { DatabaseError, type PoolClient, type TransactionStatus } from 'pg';
import { describe, expect, test } from 'vitest';

import { isCommitOutcomeUnknown, waitForReadyForQuery } from './utilities.js';

/**
 * Builds the error node-postgres reports for a SQLSTATE code.
 * @param code The SQLSTATE code, or undefined for an error without one.
 * @returns The error.
 */
const buildDatabaseError = (code: string | undefined): DatabaseError => {
  const error = new DatabaseError('PostgreSQL failed', 0, 'error');
  error.code = code;
  return error;
};

test.each([
  ['a unique violation the server answered with', buildDatabaseError('23505'), false, false],
  ['a deferred foreign key the server answered with', buildDatabaseError('23503'), false, false],
  ['any error after the connection was lost', buildDatabaseError('23505'), true, true],
  ['an error that is not a database error', new Error('Connection terminated'), false, true],
  ['a database error without a code', buildDatabaseError(undefined), false, true],
  ['a connection exception', buildDatabaseError('08006'), false, true],
  ['the server shutting down', buildDatabaseError('57P01'), false, true],
])('isCommitOutcomeUnknown(%s) -> %s', (_description, error, hasLostConnection, expectedResult) => {
  expect(isCommitOutcomeUnknown(error, hasLostConnection)).toBe(expectedResult);
});

describe('waitForReadyForQuery', () => {
  /**
   * Builds a client whose transaction status the test sets, emitting events like a real one.
   * @param status The status the client reports until the test changes it.
   * @returns The client, and a setter for its status.
   */
  const buildClient = (
    status: TransactionStatus,
  ): { client: PoolClient; setStatus: (next: TransactionStatus) => void } => {
    let currentStatus = status;
    const emitter = new EventEmitter();
    const client = Object.assign(emitter, { getTransactionStatus: () => currentStatus });
    return {
      client: client as unknown as PoolClient,
      setStatus: (next) => {
        currentStatus = next;
      },
    };
  };

  test('resolves at once when the client is already idle', async () => {
    const { client } = buildClient('I');

    await expect(waitForReadyForQuery(client)).resolves.toBeUndefined();
    expect(client.listenerCount('drain')).toBe(0);
  });

  test.each(['drain', 'end', 'error'] as const)(
    'waits for a stale status until the client emits %s, then removes its listeners',
    async (event) => {
      const { client, setStatus } = buildClient('T');
      let hasResolved = false;
      const waiting = waitForReadyForQuery(client).then(() => {
        hasResolved = true;
      });
      await Promise.resolve();
      expect(hasResolved).toBe(false);

      setStatus('I');
      client.emit(event, new Error('connection ended'));
      await waiting;

      expect(hasResolved).toBe(true);
      expect(client.listenerCount('drain')).toBe(0);
      expect(client.listenerCount('end')).toBe(0);
      expect(client.listenerCount('error')).toBe(0);
    },
  );
});
