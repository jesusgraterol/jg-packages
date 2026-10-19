import { describe, expect, test } from 'vitest';

import { readTestSuite } from './test-suite.ts';

describe('readTestSuite', () => {
  test.each([
    [{}, 'full'],
    [{ JG_TEST_SUITE: 'full' }, 'full'],
    [{ JG_TEST_SUITE: 'essential' }, 'essential'],
  ] as const)('readTestSuite(%o) -> %s', (env, suite) => {
    expect(readTestSuite(env)).toBe(suite);
  });

  test.each(['', 'quick', 'ESSENTIAL'])('rejects JG_TEST_SUITE=%j', (value) => {
    expect(() => readTestSuite({ JG_TEST_SUITE: value })).toThrow(
      'JG_TEST_SUITE must be "essential" or "full" when set.',
    );
  });
});
