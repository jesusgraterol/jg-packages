// @vitest-environment node
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS, type IRandomBytesEncoding } from '../shared/index.js';

import { generateRandomBytes, generateRandomDigits } from './random.js';

describe('generateRandomBytes', () => {
  test.each([
    [32, 'base64url', /^[A-Za-z0-9_-]{43}$/],
    [32, 'hex', /^[0-9a-f]{64}$/],
    [1, 'hex', /^[0-9a-f]{2}$/],
    [65_536, 'hex', /^[0-9a-f]{131072}$/],
  ] satisfies [number, IRandomBytesEncoding, RegExp][])(
    'generateRandomBytes(%d, %s) -> %s',
    (byteLength, encoding, pattern) => {
      expect(generateRandomBytes(byteLength, encoding)).toMatch(pattern);
    },
  );

  test('encodes as base64url by default', () => {
    expect(generateRandomBytes(32)).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  test('returns different bytes on every call', () => {
    const tokens = new Set(Array.from({ length: 64 }, () => generateRandomBytes(16)));

    expect(tokens.size).toBe(64);
  });

  test.each([0, -1, 1.5, 65_537, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects the byte length %d',
    (byteLength) => {
      expectToThrowCode(
        () => generateRandomBytes(byteLength),
        ERRORS.INVALID_BYTE_LENGTH,
        'The byte length must be an integer from 1 to 65536.',
      );
    },
  );

  test.each(['base64', 'utf8', 'HEX'])('rejects the encoding %j', (encoding) => {
    expectToThrowCode(
      () => generateRandomBytes(16, encoding as IRandomBytesEncoding),
      ERRORS.UNSUPPORTED_ENCODING,
      'The encoding must be base64url or hex.',
    );
  });
});

describe('generateRandomDigits', () => {
  test.each([1, 6, 256])('generateRandomDigits(%d) has that many digits', (count) => {
    expect(generateRandomDigits(count)).toMatch(new RegExp(`^[0-9]{${String(count)}}$`));
  });

  test('draws every digit, leading zeros included', () => {
    const digits = Array.from({ length: 40 }, () => generateRandomDigits(250)).join('');
    const firstDigits = new Set(
      Array.from({ length: 200 }, () => generateRandomDigits(1)).join(''),
    );

    // 10,000 uniform draws miss a digit with a probability below 1e-400, and 200 single-digit codes
    // are never '0' with a probability below 1e-9
    expect(new Set(digits).size).toBe(10);
    expect(firstDigits.has('0')).toBe(true);
  });

  test.each([0, -1, 2.5, 257, Number.NaN])('rejects the digit count %d', (count) => {
    expectToThrowCode(
      () => generateRandomDigits(count),
      ERRORS.INVALID_DIGIT_COUNT,
      'The digit count must be an integer from 1 to 256.',
    );
  });
});
