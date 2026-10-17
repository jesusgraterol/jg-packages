import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { MAX_TIMEOUT_SECONDS } from '../shared/index.js';
import { parseRetryAfterMs } from './retry-after.js';

// the time the date tests count from
const NOW_MS = Date.parse('Wed, 21 Oct 2015 07:28:00 GMT');

describe('parseRetryAfterMs', () => {
  test.each([
    ['0', 0],
    ['1', 1_000],
    ['120', 120_000],
    [' 30 ', 30_000],
  ])('parses the delay %j in seconds', (value, expected) => {
    expect(parseRetryAfterMs(value, NOW_MS)).toBe(expected);
  });

  test.each([
    ['Wed, 21 Oct 2015 07:28:30 GMT', 30_000],
    ['Wednesday, 21-Oct-15 07:29:00 GMT', 60_000],
    ['Wed Oct 21 07:28:05 2015', 5_000],
  ])('parses the HTTP date %j', (value, expected) => {
    expect(parseRetryAfterMs(value, NOW_MS)).toBe(expected);
  });

  test('waits 0 for a date in the past', () => {
    expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:00:00 GMT', NOW_MS)).toBe(0);
  });

  test('clamps a wait longer than MAX_TIMEOUT_SECONDS', () => {
    expect(parseRetryAfterMs('99999999999', NOW_MS)).toBe(MAX_TIMEOUT_SECONDS * 1000);
    expect(parseRetryAfterMs('Fri, 01 Jan 2100 00:00:00 GMT', NOW_MS)).toBe(
      MAX_TIMEOUT_SECONDS * 1000,
    );
  });

  test('counts from Date.now() by default', () => {
    const value = new Date(Date.now() + 60_000).toUTCString();
    const waitMs = parseRetryAfterMs(value);
    expect(waitMs).toBeGreaterThan(58_000);
    expect(waitMs).toBeLessThanOrEqual(60_000);
  });

  test('reads the first of several values', () => {
    expect(parseRetryAfterMs(['5', '10'], NOW_MS)).toBe(5_000);
    expect(parseRetryAfterMs([], NOW_MS)).toBeNull();
  });

  test.each([
    null,
    undefined,
    '',
    '  ',
    '-1',
    '1.5',
    '1e3',
    'soon',
    '5 seconds',
    'Wed, 99 Foo 2015',
  ])('returns null for %j', (value) => {
    expect(parseRetryAfterMs(value, NOW_MS)).toBeNull();
  });
});

describe('parseRetryAfterMs bounds', () => {
  test('always returns null or a whole wait from 0 to the longest timeout, whatever the header', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.nat().map(String),
          fc.date({ noInvalidDate: true }).map((date) => date.toUTCString()),
          fc.array(fc.string(), { maxLength: 2 }),
        ),
        fc.integer({ min: 0, max: 8_640_000_000_000_000 }),
        (header, nowMs) => {
          const waitMs = parseRetryAfterMs(header, nowMs);

          if (waitMs !== null) {
            expect(Number.isInteger(waitMs)).toBe(true);
            expect(waitMs).toBeGreaterThanOrEqual(0);
            expect(waitMs).toBeLessThanOrEqual(MAX_TIMEOUT_SECONDS * 1000);
          }
        },
      ),
    );
  });

  test('reads a delay in seconds as that many seconds, clamped to the longest timeout', () => {
    fc.assert(
      fc.property(fc.nat(), (seconds) => {
        expect(parseRetryAfterMs(String(seconds))).toBe(
          Math.min(seconds * 1000, MAX_TIMEOUT_SECONDS * 1000),
        );
      }),
    );
  });
});
