import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { fromScaledInteger, toScaledInteger } from './scaled-integers.js';

// Moldea's microcents: 1 dollar is 100,000,000 microcents
const MICROCENTS = 8;

describe('toScaledInteger', () => {
  // Moldea's toMicrocents cases, except the ones with digits it dropped, which now fail
  test.each([
    [0, 0n],
    [-0, 0n],
    [1, 100_000_000n],
    [12, 1_200_000_000n],
    [1.23, 123_000_000n],
    [-1.23, -123_000_000n],
    [0.12345678, 12_345_678n],
    ['987654321.1234567', 98_765_432_112_345_670n],
    ['0', 0n],
    ['-0', 0n],
    ['1', 100_000_000n],
    ['12', 1_200_000_000n],
    ['1.23', 123_000_000n],
    ['0.00000001', 1n],
    ['-0.00000001', -1n],
    ['0.12345678', 12_345_678n],
    ['-0.12345678', -12_345_678n],
    ['-987654321.1234567', -98_765_432_112_345_670n],
    ['  +1.23  ', 123_000_000n],
  ])('converts %o dollars into %s microcents', (dollars, expected) => {
    expect(toScaledInteger(dollars, MICROCENTS)).toBe(expected);
  });

  test.each([
    ['1.', 100_000_000n],
    ['.5', 50_000_000n],
    ['007.50', 750_000_000n],
    ['1.230000000000', 123_000_000n],
    [Number.MAX_SAFE_INTEGER, 900_719_925_474_099_100_000_000n],
    ['92233720368.54775807', 9_223_372_036_854_775_807n],
  ])('converts %o, which needs no rounding, into %s', (dollars, expected) => {
    expect(toScaledInteger(dollars, MICROCENTS)).toBe(expected);
  });

  test.each([
    ['12.34', 2, 1234n],
    ['12', 0, 12n],
    ['12.0', 0, 12n],
    [-12.5, 2, -1250n],
    ['1', 18, 1_000_000_000_000_000_000n],
  ])('converts %o with %d decimals into %s', (value, decimals, expected) => {
    expect(toScaledInteger(value, decimals)).toBe(expected);
  });

  test.each(['1e-8', '1.2e-7', '-1e-8', '1E3', 0.00000001, 1e-8, 1e21])(
    'rejects scientific notation, including a number JavaScript writes that way: %o',
    (dollars) => {
      expectToThrowCode(() => toScaledInteger(dollars, MICROCENTS), ERRORS.INVALID_VALUE);
    },
  );

  test.each(['1.2.3', '1..2', '-', '.', '+-1', '-+1', '', '   ', '0x10', '1,000', 'abc', '1 000'])(
    'rejects the malformed value %o',
    (dollars) => {
      expectToThrowCode(
        () => toScaledInteger(dollars, MICROCENTS),
        ERRORS.INVALID_VALUE,
        'plain decimal number with at most 8 decimals',
      );
    },
  );

  test.each([
    ['0.123456789', MICROCENTS],
    [0.123456789, MICROCENTS],
    ['-0.123456789', MICROCENTS],
    [0.1 + 0.2, MICROCENTS],
    ['12.5', 0],
    ['1.001', 2],
  ])('rejects %o, whose digits beyond %d decimals would be dropped', (value, decimals) => {
    expectToThrowCode(() => toScaledInteger(value, decimals), ERRORS.INVALID_VALUE);
  });

  test.each([NaN, Infinity, -Infinity, null, undefined, 5n, {}])(
    'rejects %o, which is neither a finite number nor a string',
    (value) => {
      expectToThrowCode(() => toScaledInteger(value as number, MICROCENTS), ERRORS.INVALID_VALUE);
    },
  );

  test.each([-1, 1.5, 101, NaN, '8' as unknown as number])(
    'rejects %o as the number of decimals',
    (decimals) => {
      expectToThrowCode(() => toScaledInteger('1', decimals), ERRORS.INVALID_DECIMAL_PLACES);
    },
  );
});

describe('fromScaledInteger', () => {
  // Moldea's toDollars cases with every digit, without the symbol and the separators it shows
  test.each([
    [0n, '0.00000000'],
    ['0', '0.00000000'],
    ['-0', '0.00000000'],
    [100_000_000n, '1.00000000'],
    ['1200000000', '12.00000000'],
    [123_000_000n, '1.23000000'],
    ['-123000000', '-1.23000000'],
    ['12345678', '0.12345678'],
    ['98765432112345670', '987654321.12345670'],
    ['-98765432112345670', '-987654321.12345670'],
    ['1', '0.00000001'],
    ['12234750000000', '122347.50000000'],
    ['  +123000000  ', '1.23000000'],
    [9_223_372_036_854_775_807n, '92233720368.54775807'],
    [-9_223_372_036_854_775_808n, '-92233720368.54775808'],
  ])('converts %o microcents into %s dollars', (microcents, expected) => {
    expect(fromScaledInteger(microcents, MICROCENTS)).toBe(expected);
  });

  test.each([
    [1234n, 2, '12.34'],
    [-5n, 2, '-0.05'],
    [1250n, 0, '1250'],
    ['-1250', 0, '-1250'],
  ])('converts %o with %d decimals into %s', (value, decimals, expected) => {
    expect(fromScaledInteger(value, decimals)).toBe(expected);
  });

  test('reverses toScaledInteger', () => {
    for (const amount of ['0.00000001', '-1.50000000', '987654321.12345670']) {
      expect(fromScaledInteger(toScaledInteger(amount, MICROCENTS), MICROCENTS)).toBe(amount);
    }
  });

  test.each(['', '   ', 'abc', '1.23', '1e8', '0x10', '+-1', 123, null])(
    'rejects %o, which is neither a bigint nor an integer string',
    (microcents) => {
      expectToThrowCode(
        () => fromScaledInteger(microcents as unknown as string, MICROCENTS),
        ERRORS.INVALID_VALUE,
        'must be a bigint or an integer string',
      );
    },
  );

  test.each([-1, 0.5, 101])('rejects %o as the number of decimals', (decimals) => {
    expectToThrowCode(() => fromScaledInteger(1n, decimals), ERRORS.INVALID_DECIMAL_PLACES);
  });
});
