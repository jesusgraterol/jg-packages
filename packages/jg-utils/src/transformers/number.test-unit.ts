// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { INumberFormatConfig } from './types.js';
import {
  prettifyBadgeCount,
  prettifyFileSize,
  prettifyNumber,
  prettifyPercentage,
} from './number.js';

describe('prettifyNumber', () => {
  test.each(<Array<[number, Partial<INumberFormatConfig> | undefined, string]>>[
    [1000.583, undefined, '1,000.58'],
    [1000.583, { maximumFractionDigits: 2 }, '1,000.58'],
    [65544152361.6432, { maximumFractionDigits: 3 }, '65,544,152,361.643'],
    [1000.583, { prefix: '$' }, '$1,000.58'],
    [2654.69642236, { maximumFractionDigits: 8, suffix: ' BTC' }, '2,654.69642236 BTC'],
    [1000, { minimumFractionDigits: 2 }, '1,000.00'],
  ])('prettifyNumber(%d, %o) -> %s', (a, b, expected) => {
    expect(prettifyNumber(a, b)).toBe(expected);
  });
});

describe('prettifyPercentage', () => {
  test.each(<Array<[number, Partial<INumberFormatConfig> | undefined, string]>>[
    [10, undefined, '10%'],
    [25.583, { maximumFractionDigits: 2 }, '25.58%'],
    [100, { prefix: '~' }, '~100%'],
    [2.65469642236, { maximumFractionDigits: 8, suffix: ' APY' }, '2.65469642% APY'],
    [100, { minimumFractionDigits: 2 }, '100.00%'],
    [-3.45, { maximumFractionDigits: 2 }, '-3.45%'],
  ])('prettifyPercentage(%d, %o) -> %s', (a, b, expected) => {
    expect(prettifyPercentage(a, b)).toBe(expected);
  });
});

describe('prettifyFileSize', () => {
  test.each([
    [1000, 2, '1000 B'],
    [2785, 2, '2.72 kB'],
    [85545, 6, '83.540039 kB'],
    [977615, 1, '954.7 kB'],
    [1211423, 2, '1.16 MB'],
    [79551423, 2, '75.87 MB'],
    [99479551423, 2, '92.65 GB'],
    [Number.MAX_SAFE_INTEGER, 2, '8.00 PB'],
  ])('prettifyFileSize(%d, %i) -> %s', (a, b, expected) => {
    expect(prettifyFileSize(a, b)).toBe(expected);
  });

  test.each([
    [1000n, 2, '1000 B'],
    [2785n, 2, '2.72 kB'],
    [85545n, 6, '83.540039 kB'],
    [977615n, 1, '954.7 kB'],
    [1211423n, 2, '1.16 MB'],
    [79551423n, 2, '75.87 MB'],
    [99479551423n, 2, '92.65 GB'],
    [BigInt(Number.MAX_SAFE_INTEGER), 2, '8.00 PB'],
  ])('prettifyFileSize(%sn, %i) -> %s', (a, b, expected) => {
    expect(prettifyFileSize(a, b)).toBe(expected);
  });

  test.each([
    [2n ** 60n, 2, '1.00 EB'],
    [9007199254740993n, 2, '8.00 PB'],
    [2n ** 70n + 2n ** 69n, 1, '1.5 ZB'],
    [2n ** 60n * 1023n + 2n ** 59n, 2, '1023.50 EB'],
    [2n ** 60n * 1024n - 1n, 2, '1.00 ZB'],
    [2n ** 90n, 2, '1024.00 YB'],
    [9007199254740993n, 0, '8 PB'],
  ])('prettifyFileSize(%sn, %i) -> %s beyond Number.MAX_SAFE_INTEGER', (a, b, expected) => {
    expect(prettifyFileSize(a, b)).toBe(expected);
  });

  test.each([
    [0, '0 B'],
    [-1, '0 B'],
    [0n, '0 B'],
    [-1n, '0 B'],
  ])('prettifyFileSize(%s) -> %s', (a, expected) => {
    expect(prettifyFileSize(a)).toBe(expected);
  });
});

describe('prettifyBadgeCount', () => {
  test.each([
    [0, undefined, undefined],
    [1, undefined, '1'],
    [9, undefined, '9+'],
    [10, undefined, '9+'],
    [9, 9, '9+'],
    [10, 9, '9+'],
    [100, 99, '99+'],
  ])('prettifyBadgeCount(%d, %d) -> %s', (a, b, expected) => {
    expect(prettifyBadgeCount(a, b)).toBe(expected);
  });
});
