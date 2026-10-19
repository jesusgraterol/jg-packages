// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { createErrorLog } from './error-log.js';

const postgres = { query: vi.fn(), transaction: vi.fn() } as unknown as IPostgres;

describe('createErrorLog', () => {
  test.each<[string, Record<string, unknown>]>([
    ['an empty origin', { origin: '' }],
    ['an origin of 257 characters', { origin: 'a'.repeat(257) }],
    ['an origin that is not a string', { origin: 7 }],
    ['redact keys that are not a list', { redactKeys: 'password' }],
    ['a redact key that is not a string', { redactKeys: ['password', 1] }],
    ['a message length of 15', { maxMessageLength: 15 }],
    ['a fractional message length', { maxMessageLength: 100.5 }],
    ['a payload size of 15 bytes', { maxPayloadBytes: 15 }],
    ['a batch size of 0', { maxBatchSize: 0 }],
    ['a batch size of 8,193', { maxBatchSize: 8_193 }],
    ['an onRecorded that is not a function', { onRecorded: 'count' }],
  ])('throws INVALID_ERROR_LOG_OPTIONS for %s', (_, options) => {
    expectToThrowCode(
      () => createErrorLog(postgres, { origin: 'api', ...options }),
      ERRORS.INVALID_ERROR_LOG_OPTIONS,
      'The error log needs an origin of 1 to 256 characters',
    );
  });

  test('throws INVALID_IDENTIFIER for a table name that is not valid', () => {
    expectToThrowCode(
      () => createErrorLog(postgres, { origin: 'api', table: '' }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });

  test('throws INVALID_TIMEOUT_PROFILE for timeouts that are not valid', () => {
    expectToThrowCode(
      () =>
        createErrorLog(postgres, {
          origin: 'api',
          timeouts: { statementTimeoutSeconds: 1, lockTimeoutSeconds: 2, queryTimeoutSeconds: 16 },
        }),
      ERRORS.INVALID_TIMEOUT_PROFILE,
    );
  });

  test('accepts the edges of every range', () => {
    expect(
      Object.keys(
        createErrorLog(postgres, {
          origin: 'a'.repeat(256),
          redactKeys: [],
          maxMessageLength: 16,
          maxPayloadBytes: 16,
          maxBatchSize: 8_192,
          onRecorded: () => undefined,
        }),
      ),
    ).toStrictEqual(['record', 'recordMany']);
    expect(() => createErrorLog(postgres, { origin: 'api', maxBatchSize: 1 })).not.toThrow();
  });
});
