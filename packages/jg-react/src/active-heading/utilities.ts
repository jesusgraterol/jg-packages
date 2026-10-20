import { ACTIVE_HEADING_TOLERANCE_PX } from './constants.js';

/**
 * Reads the heading id a URL's hash points to, such as `#getting-started`, decoding it.
 * @param hash The hash, with its `#`.
 * @returns The id, or null for an empty or malformed hash.
 */
export const readHeadingIdFromHash = (hash: string): string | null => {
  if (hash.length <= 1) {
    return null;
  }
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return null;
  }
};

/**
 * Picks the heading the reader is at: the last one whose top has reached the offset, or the first
 * one when none has.
 * @param elements The headings' elements, in page order.
 * @param topOffsetPx The height of what covers the top of the viewport.
 * @returns The heading's id, or null without headings.
 */
export const pickActiveHeadingId = (
  elements: readonly HTMLElement[],
  topOffsetPx: number,
): string | null => {
  let reached: HTMLElement | undefined;
  for (const element of elements) {
    if (element.getBoundingClientRect().top <= topOffsetPx + ACTIVE_HEADING_TOLERANCE_PX) {
      reached = element;
    }
  }
  return (reached ?? elements[0])?.id ?? null;
};
