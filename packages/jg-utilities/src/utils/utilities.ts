import { FENCED_CODE_BLOCK_PATTERN, MARKDOWN_HEADING_PATTERN } from './constants.js';
import { normalizeItemValue } from './transformers.js';

/**
 * Applies the filter to the items based on the query tokens and returns a filtered list.
 * @param items The list of items to be filtered.
 * @param queryTokens The array of normalized query tokens to filter the items by.
 * @param queryProp The property of the item to filter by, if not provided, the whole item will be used for filtering.
 * @returns The filtered array of items that match the query tokens.
 */
export const filterItemsByQueryTokens = <T>(
  items: T[],
  queryTokens: string[],
  queryProp: keyof T | undefined,
): T[] =>
  items.filter((item) => {
    const itemValue = normalizeItemValue(typeof queryProp === 'string' ? item[queryProp] : item);
    return queryTokens.some((token) => itemValue.includes(token));
  });

/**
 * Reads the fenced code block marker from a markdown line.
 * @param line The markdown line to inspect.
 * @returns The fence marker when the line opens or closes a fence, otherwise null.
 */
export const extractFenceMarker = (line: string): string | null => {
  const leadingWhitespaceLength = line.length - line.trimStart().length;

  if (leadingWhitespaceLength > 3) {
    return null;
  }

  const match = FENCED_CODE_BLOCK_PATTERN.exec(line.trimStart());

  return match?.[1] ?? null;
};

/**
 * Checks whether a markdown line closes the active fenced code block.
 * @param line The markdown line to inspect.
 * @param openingFenceMarker The fence marker that opened the active code block.
 * @returns True when the line closes the active fenced code block.
 */
export const isClosingFence = (line: string, openingFenceMarker: string): boolean => {
  const fenceMarker = extractFenceMarker(line);

  if (
    fenceMarker === null ||
    fenceMarker[0] !== openingFenceMarker[0] ||
    fenceMarker.length < openingFenceMarker.length
  ) {
    return false;
  }

  return line.trimStart().slice(fenceMarker.length).trim().length === 0;
};

/**
 * Extracts the section name from a markdown heading line.
 * @param line The markdown line to inspect.
 * @returns The normalized heading text when the line is a usable heading, otherwise null.
 */
export const extractHeadingName = (line: string): string | null => {
  const match = MARKDOWN_HEADING_PATTERN.exec(line);
  const rawHeadingName = match?.[1];

  if (rawHeadingName === undefined) {
    return null;
  }

  const headingName = rawHeadingName.replace(/[ \t]+#+[ \t]*$/, '').trim();

  return headingName.length > 0 ? headingName : null;
};
