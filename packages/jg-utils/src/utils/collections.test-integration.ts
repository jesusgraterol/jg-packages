// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { shuffleArray } from './collections.js';

describe('Object management helpers', () => {
  describe('shuffleArray', () => {
    test.each<[unknown[]]>([
      [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']],
      [[{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }, { e: 5 }]],
    ])('shuffleArray(%o) -> a reordered copy holding the same items', (arr) => {
      // a single shuffle can return the original order (1 in 120 for five items), so take several
      const shuffles = Array.from({ length: 20 }, () => shuffleArray(arr));

      shuffles.forEach((shuffled) => {
        expect(shuffled).not.toBe(arr);
        expect(shuffled).toHaveLength(arr.length);
        expect(new Set(shuffled)).toStrictEqual(new Set(arr));
      });
      expect(shuffles.some((shuffled) => shuffled.some((item, index) => item !== arr[index]))).toBe(
        true,
      );
    });

    test.each<[unknown]>([
      [[]],
      [[1]],
      [[1]],
      [1],
      ['a'],
      [new Set([1, 2, 3, 4, 5])],
      [
        new Map([
          ['a', 1],
          ['b', 2],
          ['c', 3],
        ]),
      ],
    ])('shuffleArray(%o)', (arr) => {
      expectToThrowCode(() => shuffleArray(arr as never), ERRORS.INVALID_OR_EMPTY_ARRAY);
    });
  });
});
