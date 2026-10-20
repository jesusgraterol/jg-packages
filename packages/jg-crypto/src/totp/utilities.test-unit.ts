// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { decodeBase32, encodeBase32 } from './utilities.js';

// RFC 4648's base32 test vectors, without their padding
const RFC_4648_VECTORS = [
  ['', ''],
  ['f', 'MY'],
  ['fo', 'MZXQ'],
  ['foo', 'MZXW6'],
  ['foob', 'MZXW6YQ'],
  ['fooba', 'MZXW6YTB'],
  ['foobar', 'MZXW6YTBOI'],
] as const;

describe('encodeBase32', () => {
  test.each(RFC_4648_VECTORS)('encodeBase32(%j) -> %j', (text, base32) => {
    expect(encodeBase32(Buffer.from(text))).toBe(base32);
  });
});

describe('decodeBase32', () => {
  test.each(RFC_4648_VECTORS)('decodeBase32 reads %j back from %j', (text, base32) => {
    expect(decodeBase32(base32)?.toString('utf8')).toBe(text);
  });

  test('reads padding and lowercase', () => {
    expect(decodeBase32('mzxw6ytboi======')?.toString('utf8')).toBe('foobar');
  });

  test.each([['MZXW6YTB1'], ['MZ XW'], ['MZ=XW']])('decodeBase32(%j) -> null', (base32) => {
    expect(decodeBase32(base32)).toBeNull();
  });
});
