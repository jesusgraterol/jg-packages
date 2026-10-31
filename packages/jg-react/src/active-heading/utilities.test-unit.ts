import { describe, expect, test } from 'vitest';

import { pickActiveHeadingId, readHeadingIdFromHash } from './utilities.js';

/**
 * Builds a heading whose top is at a position in the viewport.
 * @param id The heading's id.
 * @param top Its top, in pixels from the viewport's top.
 * @returns The heading.
 */
const heading = (id: string, top: number) =>
  ({ id, getBoundingClientRect: () => ({ top }) }) as unknown as HTMLElement;

describe('readHeadingIdFromHash', { tags: ['full'] }, () => {
  test.each([
    ['#getting-started', 'getting-started'],
    ['#caf%C3%A9', 'café'],
    ['#', null],
    ['', null],
    ['#%E0%A4%A', null],
  ])('readHeadingIdFromHash(%j) -> %j', (hash, expected) => {
    expect(readHeadingIdFromHash(hash)).toBe(expected);
  });
});

describe('pickActiveHeadingId', { tags: ['full'] }, () => {
  test('picks the last heading whose top reached the offset, with a tolerance of 16 pixels', () => {
    expect(pickActiveHeadingId([heading('a', -400), heading('b', 96), heading('c', 97)], 80)).toBe(
      'b',
    );
  });

  test('picks the first heading before any reached the offset, and nothing without headings', () => {
    expect(pickActiveHeadingId([heading('a', 300), heading('b', 900)], 80)).toBe('a');
    expect(pickActiveHeadingId([], 80)).toBeNull();
  });
});
