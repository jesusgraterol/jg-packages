// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { deleteExpiredInBatches } from './retention.js';
import type { IExpiredRowDeletionOptions } from './types.js';

/**
 * Builds a database whose every call is a spy, so a test can tell nothing reached it.
 * @returns The database and its spies.
 */
const createSpiedPostgres = (): {
  postgres: IPostgres;
  query: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
} => {
  const query = vi.fn();
  const transaction = vi.fn();
  return {
    postgres: { pool: { query }, query, transaction } as unknown as IPostgres,
    query,
    transaction,
  };
};

describe('deleteExpiredInBatches', () => {
  test.each<[string, Record<string, unknown>]>([
    ['neither olderThan nor cutoff', {}],
    ['both olderThan and cutoff', { olderThan: { days: 1 }, cutoff: '2026-01-01T00:00:00.000Z' }],
    ['an olderThan that is not an object', { olderThan: 30 }],
    ['an olderThan that is null', { olderThan: null }],
    ['an olderThan that is an array', { olderThan: [1] }],
    ['an olderThan of zero', { olderThan: {} }],
    ['an olderThan whose fields are all 0', { olderThan: { months: 0, days: 0, seconds: 0 } }],
    ['negative months', { olderThan: { months: -1 } }],
    ['fractional days', { olderThan: { days: 1.5 } }],
    ['months past make_interval', { olderThan: { months: 2_147_483_648 } }],
    ['negative seconds', { olderThan: { seconds: -60 } }],
    ['a cutoff that is not a date', { cutoff: 'yesterday-ish' }],
    ['a cutoff that is a number', { cutoff: 1_700_000_000_000 }],
    ['an invalid Date', { cutoff: new Date('not a date') }],
    ['a batch size of 0', { olderThan: { days: 1 }, batchSize: 0 }],
    ['a batch size of 8,193', { olderThan: { days: 1 }, batchSize: 8_193 }],
    ['a fractional batch size', { olderThan: { days: 1 }, batchSize: 1.5 }],
    ['filters that are not a list', { olderThan: { days: 1 }, filters: { column: 'tenant_id' } }],
    ['a filter without a column', { olderThan: { days: 1 }, filters: [{ value: 1 }] }],
    ['a filter that is null', { olderThan: { days: 1 }, filters: [null] }],
  ])(
    'rejects %s with INVALID_EXPIRED_DELETION, before touching the database',
    async (_, options) => {
      const { postgres, query, transaction } = createSpiedPostgres();

      await expectToRejectCode(
        deleteExpiredInBatches(postgres, { table: 'audit_event', ...options }),
        ERRORS.INVALID_EXPIRED_DELETION,
        'The expired-row deletion needs exactly one of olderThan',
      );
      expect(query).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    },
  );

  test.each<[string, Partial<IExpiredRowDeletionOptions>]>([
    ['an empty table name', { table: '' }],
    ['a timestamp column longer than 63 bytes', { timestampColumn: 'a'.repeat(64) }],
    ['a key column with a null character', { keyColumn: 'id\0' }],
    ['a filter column that is empty', { filters: [{ column: '', value: 1 }] }],
  ])('rejects %s with INVALID_IDENTIFIER, before touching the database', async (_, options) => {
    const { postgres, query } = createSpiedPostgres();

    await expectToRejectCode(
      deleteExpiredInBatches(postgres, {
        table: 'audit_event',
        cutoff: '2026-01-01T00:00:00.000Z',
        ...options,
      }),
      ERRORS.INVALID_IDENTIFIER,
    );
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['an ISO string', '2026-01-01T00:00:00Z'],
    ['a Date', new Date('2026-01-01T00:00:00.000Z')],
  ])('accepts a cutoff given as %s, and the edges of the batch size', async (_, cutoff) => {
    const { postgres, query } = createSpiedPostgres();
    query.mockResolvedValue({ rowCount: 0 });

    for (const batchSize of [1, 8_192]) {
      await expect(
        deleteExpiredInBatches(postgres, { table: 'audit_event', cutoff, batchSize }),
      ).resolves.toStrictEqual({ deletedCount: 0, cutoff: '2026-01-01T00:00:00.000Z' });
    }
    expect(query).toHaveBeenNthCalledWith(1, expect.stringContaining('LIMIT $2'), [
      '2026-01-01T00:00:00.000Z',
      1,
    ]);
  });
});
