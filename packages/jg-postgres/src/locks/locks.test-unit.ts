import { describe, expect, test } from 'vitest';

import { POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN } from '../shared/index.js';
import { createAdvisoryLockKey } from './locks.js';

describe('createAdvisoryLockKey', () => {
  // the keys Moldea's createAdvisoryLockKey returns, so both lock the same rows
  test.each([
    ['ordered-list:knowledge-base-categories', '-6206141566785237946'],
    ['ordered-list:platform-notices', '5417464595092586869'],
    ['moldea', '7480330268761432310'],
    ['', '-2039914840885289964'],
  ])('createAdvisoryLockKey(%s) -> %s', (name, expected) => {
    expect(createAdvisoryLockKey(name)).toBe(expected);
  });

  test('returns the same key for the same name, and a different one for another', () => {
    const name = 'ordered-list:knowledge-base-categories';

    expect(createAdvisoryLockKey(name)).toBe(createAdvisoryLockKey(name));
    expect(createAdvisoryLockKey(name)).not.toBe(
      createAdvisoryLockKey('ordered-list:platform-notices'),
    );
  });

  test('returns a signed 64-bit integer, as BIGINT holds', () => {
    const key = BigInt(createAdvisoryLockKey('ordered-list:knowledge-base-categories'));

    expect(key >= POSTGRES_BIGINT_MIN && key <= POSTGRES_BIGINT_MAX).toBe(true);
  });
});
