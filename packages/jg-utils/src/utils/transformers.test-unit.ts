// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { buildNormalizedQueryTokens, normalizeItemValue } from './transformers.js';

describe('buildNormalizedQueryTokens', () => {
  test.each([
    ['hello world', ['hello', 'world']],
    ['  leading and trailing spaces  ', ['leading', 'and', 'trailing', 'spaces']],
    ['multiple   spaces', ['multiple', 'spaces']],
    ['', []],
    ['   ', []],
    ['singleword', ['singleword']],
    ['123 456 789', ['123', '456', '789']],
  ])('buildNormalizedQueryTokens(%s) -> %o', (value, expected) => {
    expect(buildNormalizedQueryTokens(value)).toStrictEqual(expected);
  });
});

describe('normalizeItemValue', () => {
  test.each([
    ['', ''],
    ['Hello', 'hello'],
    [true, 'true'],
    [false, 'false'],
    [123456.85, '123456.85'],
    [null, ''],
    [undefined, ''],
    [['a', 'b', 'c'], 'a b c'],
    [
      { a: 1, b: '2', c: true, d: 'WOW', e: { foo: 'Baz!' }, f: [1, 2, 3] },
      '1 2 true wow baz! 1 2 3',
    ],
    [
      [
        { a: 'Joe', b: 'Doe' },
        { a: 'Jane', b: 'Dae' },
      ],
      'joe doe jane dae',
    ],
  ])('normalizeItemValue(%o) -> %s', (value, expected) => {
    expect(normalizeItemValue(value)).toBe(expected);
  });
});
