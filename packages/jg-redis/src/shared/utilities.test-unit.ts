import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from './errors.js';
import { assertTtl } from './utilities.js';

describe('assertTtl', () => {
  test.each([1, 60, 31_536_000])('assertTtl(%d) -> accepts it', (ttlSeconds) => {
    expect(() => {
      assertTtl(ttlSeconds);
    }).not.toThrow();
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'assertTtl(%d) -> INVALID_TTL',
    (ttlSeconds) => {
      expectToThrowCode(
        () => {
          assertTtl(ttlSeconds);
        },
        ERRORS.INVALID_TTL,
        'The time-to-live must be a whole number of seconds, from 1.',
      );
    },
  );
});
