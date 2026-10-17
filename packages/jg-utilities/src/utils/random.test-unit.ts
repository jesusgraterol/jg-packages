import { describe, expect, test } from 'vitest';

import { drawUniformIndex, drawUniformInteger, type IUint32Source } from './random.js';

/**
 * Builds a source that returns the given 32-bit values in order.
 * @param values The values.
 * @returns The source.
 */
const sequence = (...values: number[]): IUint32Source => {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    if (value === undefined) {
      throw new Error('The test source ran out of values.');
    }
    return value;
  };
};

describe('drawUniformIndex', () => {
  test('discards draws in the incomplete last block of the 32-bit range', () => {
    // 2^32 % 3 is 1, so the top value would make 0 likelier, and is drawn again
    expect(drawUniformIndex(3, sequence(0xffff_ffff, 7))).toBe(1);
  });
});

describe('drawUniformInteger', () => {
  test('draws spans above 2^32 from 53-bit values, discarding the incomplete last block', () => {
    const span = 2 ** 32 + 1;

    // the first two draws make the largest 53-bit value, past the last complete block
    expect(drawUniformInteger(span, sequence(0xffff_ffff, 0xffff_ffff, 0, 5))).toBe(5);
  });

  test('scales a 53-bit fraction for spans above 2^53, which no integer draw covers exactly', () => {
    expect(drawUniformInteger(2 ** 60, sequence(0, 0))).toBe(0);
    expect(drawUniformInteger(2 ** 60, sequence(0x8000_0000, 0))).toBe(2 ** 59);
  });
});
