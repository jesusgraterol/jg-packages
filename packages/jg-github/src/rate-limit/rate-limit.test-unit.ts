// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { getGithubRateLimitDeadline } from './rate-limit.js';

const NOW = Date.UTC(2026, 8, 10);
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const NOW_SECONDS = NOW / SECOND;

// the response headers each row sets, by the names Moldea's table used
type IHeaderOverrides = {
  retryAfter?: string;
  rateLimitRemaining?: string;
  rateLimitReset?: string;
};

/**
 * Builds a response's headers from a row's overrides.
 * @param overrides The row's headers.
 * @returns The headers.
 */
const buildHeaders = ({
  retryAfter,
  rateLimitRemaining,
  rateLimitReset,
}: IHeaderOverrides): Headers => {
  const headers = new Headers();
  if (retryAfter !== undefined) headers.set('retry-after', retryAfter);
  if (rateLimitRemaining !== undefined) headers.set('x-ratelimit-remaining', rateLimitRemaining);
  if (rateLimitReset !== undefined) headers.set('x-ratelimit-reset', rateLimitReset);
  return headers;
};

describe('getGithubRateLimitDeadline', () => {
  // Moldea's table, row for row
  test.each([
    [200, {}, false, 0, null],
    [
      200,
      { rateLimitRemaining: '0', rateLimitReset: String(NOW_SECONDS + 64) },
      false,
      0,
      64 * SECOND,
    ],
    [403, {}, false, 0, null],
    [403, {}, true, 0, MINUTE],
    [429, {}, false, 1, 2 * MINUTE],
    [429, {}, false, 2, 4 * MINUTE],
    [403, { retryAfter: '8' }, false, 0, 8 * SECOND],
    [
      429,
      { retryAfter: '120', rateLimitRemaining: '0', rateLimitReset: String(NOW_SECONDS + 64) },
      false,
      0,
      2 * MINUTE,
    ],
    [
      429,
      { retryAfter: '8', rateLimitRemaining: '0', rateLimitReset: String(NOW_SECONDS + 64) },
      false,
      0,
      64 * SECOND,
    ],
    [403, { retryAfter: new Date(NOW + 32 * SECOND).toUTCString() }, false, 0, 32 * SECOND],
    [429, { retryAfter: 'NaN', rateLimitRemaining: '0', rateLimitReset: 'no' }, false, 0, MINUTE],
    [429, { retryAfter: '-8', rateLimitRemaining: '0', rateLimitReset: '-4' }, false, 0, MINUTE],
    [
      429,
      {
        retryAfter: '99999999999999999999',
        rateLimitRemaining: '0',
        rateLimitReset: '99999999999999999999',
      },
      false,
      0,
      MINUTE,
    ],
    [
      429,
      { retryAfter: '0', rateLimitRemaining: '0', rateLimitReset: String(NOW_SECONDS - 8) },
      false,
      0,
      MINUTE,
    ],
    [429, { retryAfter: '1.5' }, false, 0, MINUTE],
    [403, { rateLimitRemaining: '4', rateLimitReset: String(NOW_SECONDS + 64) }, false, 0, null],
    [
      429,
      { retryAfter: '8', rateLimitRemaining: '4', rateLimitReset: String(NOW_SECONDS + 64) },
      false,
      0,
      8 * SECOND,
    ],
  ] as const)(
    'getGithubRateLimitDeadline(%d, %o, %s, %d) -> %s',
    (status, overrides, hasRateLimitMessage, retryCount, delay) => {
      expect(
        getGithubRateLimitDeadline({
          status,
          headers: buildHeaders(overrides),
          retryCount,
          hasRateLimitMessage,
          now: new Date(NOW),
        }),
      ).toStrictEqual(delay === null ? null : new Date(NOW + delay));
    },
  );

  test("reads a record of lowercase headers, as Node.js's IncomingHttpHeaders, ignoring a repeated one", () => {
    expect(
      getGithubRateLimitDeadline({
        status: 429,
        headers: { 'retry-after': '8', 'x-ratelimit-remaining': ['0', '0'] },
        retryCount: 0,
        now: new Date(NOW),
      }),
    ).toStrictEqual(new Date(NOW + 8 * SECOND));
  });

  test('rejects an RFC 850 or asctime date, which only a strict IMF-fixdate replaces', () => {
    for (const retryAfter of ['Thursday, 10-Sep-26 00:00:32 GMT', 'Thu Sep 10 00:00:32 2026']) {
      expect(
        getGithubRateLimitDeadline({
          status: 429,
          headers: buildHeaders({ retryAfter }),
          retryCount: 0,
          now: new Date(NOW),
        }),
      ).toStrictEqual(new Date(NOW + MINUTE));
    }
  });

  test('uses the current time by default', () => {
    const before = Date.now();
    const deadline = getGithubRateLimitDeadline({ status: 429, headers: {}, retryCount: 0 });

    expect(deadline?.getTime()).toBeGreaterThanOrEqual(before + MINUTE);
    expect(deadline?.getTime()).toBeLessThanOrEqual(Date.now() + MINUTE);
  });

  test.each([
    ['a status that is not an HTTP status', { status: 42 }],
    ['a fractional status', { status: 429.5 }],
    ['headers that are not an object', { headers: null }],
    ['a negative retry count', { retryCount: -1 }],
    ['a fractional retry count', { retryCount: 0.5 }],
    ['a time that is not a date', { now: NOW }],
    ['an invalid date', { now: new Date(Number.NaN) }],
  ])('rejects %s', (_description, overrides) => {
    expectToThrowCode(
      () =>
        getGithubRateLimitDeadline({
          status: 429,
          headers: {},
          retryCount: 0,
          ...overrides,
        } as Parameters<typeof getGithubRateLimitDeadline>[0]),
      ERRORS.GITHUB_INVALID_ARGUMENT,
    );
  });
});
