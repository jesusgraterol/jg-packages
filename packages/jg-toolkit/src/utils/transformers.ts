import { isArrayValid, isObjectValid } from '../validations/index.js';

/**
 * Builds an array of normalized query tokens from a given query string.
 * @param query The query string to be normalized and tokenized.
 * @returns A normalized array of query tokens.
 */
export const buildNormalizedQueryTokens = (query: string): string[] =>
  query.toLowerCase().split(' ').filter(Boolean);

/**
 * Stringifies a value so it can be compared in a case-insensitive manner.
 * @param value The value to be normalized.
 * @returns A normalized string representation of the value.
 */
export const normalizeItemValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.toLowerCase();
  }
  if (isObjectValid(value, true)) {
    return Object.values(value).map(normalizeItemValue).join(' ');
  }
  if (isArrayValid(value, true)) {
    return value.map(normalizeItemValue).join(' ');
  }
  // objects and arrays are handled above, so only primitives and functions reach String
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return value !== null && value !== undefined ? String(value).toLowerCase() : '';
};
