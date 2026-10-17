// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  generateDateId,
  generateRandomFloat,
  generateRandomInteger,
  generateRandomString,
  generateSequence,
} from './generators.js';

/**
 * Replaces crypto.getRandomValues with one that returns the given 32-bit values in order, then
 * zeros, so the random functions' sampling can be checked exactly.
 * @param values The values to return.
 */
const stubRandomValues = (values: number[]): void => {
  const queue = [...values];
  vi.stubGlobal('crypto', {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint32Array) {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = queue.shift() ?? 0;
        }
      }
      return array;
    },
  });
};

describe('Generators', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('generateRandomFloat', () => {
    test('uses 53 bits of randomness without ever reaching the maximum', () => {
      stubRandomValues([0x80000000, 0, 0xffffffff, 0xffffffff, 0, 0]);

      expect(generateRandomFloat(0, 1)).toBe(0.5);
      expect(generateRandomFloat(0, 1)).toBe((2 ** 53 - 1) / 2 ** 53);
      expect(generateRandomFloat(5, 10)).toBe(5);
    });

    test('stays within [min, max) over many real draws', () => {
      const draws = Array.from({ length: 10_000 }, () => generateRandomFloat(-2, 3));

      expect(Math.min(...draws)).toBeGreaterThanOrEqual(-2);
      expect(Math.max(...draws)).toBeLessThan(3);
    });
  });

  describe('generateRandomInteger', () => {
    test('includes both ends of the range', () => {
      // each call fills a batch of two values and uses the first
      stubRandomValues([0, 0, 9, 0]);

      expect(generateRandomInteger(1, 10)).toBe(1);
      expect(generateRandomInteger(1, 10)).toBe(10);
    });

    test('rejects draws from the incomplete last block, so no integer is favoured', () => {
      // 2^32 mod 10 = 6, so the six highest 32-bit values are rejected for a span of 10
      stubRandomValues([0xffffffff, 2 ** 32 - 6, 2 ** 32 - 7]);

      expect(generateRandomInteger(1, 10)).toBe(((2 ** 32 - 7) % 10) + 1);
    });

    test('covers spans wider than 32 bits with 53-bit draws', () => {
      stubRandomValues([0xffffffff, 0xffffffff]);

      expect(generateRandomInteger(0, 2 ** 53 - 1)).toBe(2 ** 53 - 1);
    });

    test('draws every integer about equally often over many real draws', () => {
      const counts = new Map<number, number>();
      for (let draw = 0; draw < 60_000; draw += 1) {
        const value = generateRandomInteger(1, 6);
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      expect([...counts.keys()].sort()).toStrictEqual([1, 2, 3, 4, 5, 6]);
      counts.forEach((count) => {
        // 10,000 expected per face; 600 is more than six standard deviations
        expect(Math.abs(count - 10_000)).toBeLessThan(600);
      });
    });
  });

  describe('generateRandomString', () => {
    test('picks each character with rejection sampling', () => {
      // 2^32 mod 3 = 1, so only the highest 32-bit value is rejected for three characters
      stubRandomValues([0, 1, 2, 0xffffffff, 5]);

      expect(generateRandomString(4, 'abc')).toBe('abcc');
    });

    test.each([
      [0, 'abc'],
      [-1, 'abc'],
      [5, ''],
    ])('generateRandomString(%d, %o) -> an empty string', (length, characters) => {
      expect(generateRandomString(length, characters)).toBe('');
    });

    test('generates long strings in batches of random values', () => {
      const getRandomValues = vi.spyOn(crypto, 'getRandomValues');

      expect(generateRandomString(40_000, 'ab')).toMatch(/^[ab]{40000}$/);
      expect(getRandomValues.mock.calls.length).toBeLessThanOrEqual(4);
    });

    test('draws every character about equally often over many real draws', () => {
      const counts = new Map<string, number>();
      for (const character of generateRandomString(60_000, 'abcdef')) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }

      expect([...counts.keys()].sort()).toStrictEqual(['a', 'b', 'c', 'd', 'e', 'f']);
      counts.forEach((count) => {
        expect(Math.abs(count - 10_000)).toBeLessThan(600);
      });
    });
  });

  describe('generateSequence', () => {
    test.each([
      [1, 10, 1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
      [1, 10, 2, [1, 3, 5, 7, 9]],
      [0, 4, 1, [0, 1, 2, 3, 4]],
    ])('generateSequence(%d, %d, %d) -> %o', (a, b, c, expected) => {
      expect(generateSequence(a, b, c)).toStrictEqual(expected);
    });
  });

  describe('generateDateId', () => {
    test.each(<Array<[Date | number | string, string]>>[
      [new Date(2024, 0, 5, 12), '2024_01_05'],
      [new Date(2024, 10, 15, 12).getTime(), '2024_11_15'],
      ['2024-12-31T12:00:00', '2024_12_31'],
      ['2026-06-26T12:27:45.571Z', '2026_06_26'],
      [1782476885050, '2026_06_26'],
      ['2022-01-07T12:30:09.449Z', '2022_01_07'],
      [1641558609449, '2022_01_07'],
    ])('generateDateId(%o) -> %s', (value, expected) => {
      expect(generateDateId(value)).toBe(expected);
    });

    test('uses the current date when no value is provided', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 2, 9, 12));

      expect(generateDateId()).toBe('2025_03_09');
    });
  });
});
