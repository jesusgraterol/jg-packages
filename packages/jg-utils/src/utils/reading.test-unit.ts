// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { estimateReadingTime } from './reading.js';

describe('estimateReadingTime', () => {
  test.each(<Array<[unknown, number]>>[
    [undefined, 0],
    [null, 0],
    [false, 0],
    [123, 0],
    [[], 0],
    [{}, 0],
    ['', 0],
    ['   \t\n  ', 0],
    ['word', 300],
    ['two words', 600],
    ['  spaces   between\twords\nand lines  ', 1_500],
    ['words\u00a0separated\u00a0by non-breaking spaces', 1_500],
    ['word '.repeat(200), 60_000],
    ['word '.repeat(201), 60_300],
  ])('estimateReadingTime(%o) -> %d', (text, expected) => {
    expect(estimateReadingTime(text)).toBe(expected);
  });
});
