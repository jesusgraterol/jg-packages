import { describe, expect, test } from 'vitest';

import { normalizeIp } from './utilities.js';

describe('normalizeIp', () => {
  test.each([
    ['203.0.113.7', '203.0.113.7'],
    [' 203.0.113.7\n', '203.0.113.7'],
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::FFFF:203.0.113.7', '203.0.113.7'],
    ['2001:DB8::1', '2001:db8::1'],
    ['::ffff:cb00:7107', '::ffff:cb00:7107'],
    ['::ffff:203.0.113', '::ffff:203.0.113'],
    ['::1', '::1'],
    ['', ''],
  ])('normalizeIp(%s) -> %s', (ip, expected) => {
    expect(normalizeIp(ip)).toBe(expected);
  });
});
