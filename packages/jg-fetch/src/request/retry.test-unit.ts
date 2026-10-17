import { describe, expect, test } from 'vitest';

import { DEFAULT_RETRY_METHODS, DEFAULT_RETRY_STATUS_CODES } from '../shared/index.js';
import { decideRetry, type IRetryInput } from './retry.js';

/**
 * Builds a retryable failure of the first attempt.
 * @param input The fields to override.
 * @returns The input.
 */
const failure = (input: Partial<IRetryInput> = {}): IRetryInput => ({
  attempt: 1,
  method: 'GET',
  kind: 'HTTP_ERROR',
  code: 'HTTP_ERROR',
  status: 503,
  isAttemptTimeout: false,
  retryAfterMs: null,
  hasStreamBody: false,
  remainingMs: 60_000,
  retryDelaysMs: [3_000, 5_000],
  retryMethods: DEFAULT_RETRY_METHODS,
  retryStatusCodes: DEFAULT_RETRY_STATUS_CODES,
  nonRetryableErrorCodes: [],
  maxRetryAfterMs: 30_000,
  ...input,
});

describe('decideRetry', () => {
  test('retries a retryable status after the scheduled delay', () => {
    expect(decideRetry(failure())).toStrictEqual({ shouldRetry: true, delayMs: 3_000 });
    expect(decideRetry(failure({ attempt: 2 }))).toStrictEqual({
      shouldRetry: true,
      delayMs: 5_000,
    });
  });

  test('stops once the schedule runs out', () => {
    expect(decideRetry(failure({ attempt: 3 }))).toStrictEqual({ shouldRetry: false });
    expect(decideRetry(failure({ retryDelaysMs: [] }))).toStrictEqual({ shouldRetry: false });
  });

  test.each([
    ['a network error', { kind: 'NETWORK_ERROR', code: 'NETWORK_ERROR', status: null }],
    [
      'an attempt timeout',
      { kind: 'TIMEOUT', code: 'TIMEOUT', status: null, isAttemptTimeout: true },
    ],
    ['an API error with a retryable status', { kind: 'API_ERROR', code: 'BUSY', status: 503 }],
  ] as const)('retries %s', (_description, input) => {
    expect(decideRetry(failure(input)).shouldRetry).toBe(true);
  });

  test.each([
    ['the whole call timing out', { kind: 'TIMEOUT', code: 'TIMEOUT', status: null }],
    ['an abort', { kind: 'ABORTED', code: 'ABORTED', status: null }],
    ['a parse error', { kind: 'PARSE_ERROR', code: 'PARSE_ERROR', status: 200 }],
    ['an invalid response', { kind: 'RESPONSE_INVALID', code: 'RESPONSE_INVALID', status: 200 }],
    ['a status outside retryStatusCodes', { status: 501 }],
    ['a POST', { method: 'POST' }],
    ['a stream body', { hasStreamBody: true }],
    [
      'a code in nonRetryableErrorCodes',
      { kind: 'API_ERROR', code: 'QUOTA', nonRetryableErrorCodes: ['QUOTA'] },
    ],
    ['a 429 without Retry-After', { status: 429 }],
  ] as const)('does not retry %s', (_description, input) => {
    expect(decideRetry(failure(input))).toStrictEqual({ shouldRetry: false });
  });

  test('never retries NON_RETRYABLE_STATUS_CODES, even when retryStatusCodes lists them', () => {
    for (const status of [400, 401, 402, 403, 404, 405, 409, 410, 413, 422]) {
      expect(decideRetry(failure({ status, retryStatusCodes: [status] }))).toStrictEqual({
        shouldRetry: false,
      });
    }
    expect(decideRetry(failure({ status: 418, retryStatusCodes: [418] })).shouldRetry).toBe(true);
  });

  test('a 429 with Retry-After waits the larger of the delay and Retry-After', () => {
    expect(decideRetry(failure({ status: 429, retryAfterMs: 10_000 }))).toStrictEqual({
      shouldRetry: true,
      delayMs: 10_000,
    });
    expect(decideRetry(failure({ status: 429, retryAfterMs: 1_000 }))).toStrictEqual({
      shouldRetry: true,
      delayMs: 3_000,
    });
    expect(decideRetry(failure({ status: 503, retryAfterMs: 4_000 }))).toStrictEqual({
      shouldRetry: true,
      delayMs: 4_000,
    });
  });

  test('stops when Retry-After exceeds the cap or the wait exceeds the time left', () => {
    expect(
      decideRetry(failure({ status: 429, retryAfterMs: 31_000, maxRetryAfterMs: 30_000 })),
    ).toStrictEqual({ shouldRetry: false });
    expect(
      decideRetry(failure({ status: 429, retryAfterMs: 10_000, remainingMs: 9_000 })),
    ).toStrictEqual({ shouldRetry: false });
    expect(decideRetry(failure({ remainingMs: 3_000 }))).toStrictEqual({ shouldRetry: false });
  });
});
