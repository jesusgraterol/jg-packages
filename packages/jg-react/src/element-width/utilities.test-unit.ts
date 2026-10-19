// @vitest-environment node
import { expect, test } from 'vitest';

import { readBorderBoxWidth } from './utilities.js';

// an element that measures 320 pixels wide
const element = { getBoundingClientRect: () => ({ width: 320 }) } as unknown as Element;

test.each([
  ['an entry with a border box', { borderBoxSize: [{ inlineSize: 480 }] }, 480],
  ['an entry without a border box', { borderBoxSize: [] }, 320],
  ['no entry', undefined, 320],
])('readBorderBoxWidth(%s) -> %d', (_, entry, expected) => {
  expect(readBorderBoxWidth(entry as ResizeObserverEntry | undefined, element)).toBe(expected);
});
