import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { isArrayValid, isObjectValid, isStringValid } from '../validations/index.js';

import type { ISubstitutionOptions } from './types.js';

/**
 * Capitalizes the first letter of a string and returns the new value.
 * @param value The string value to capitalize.
 * @returns A string with the first letter capitalized.
 * @example
 * capitalizeFirst('hello world'); // 'Hello world'
 */
export const capitalizeFirst = (value: string): string =>
  value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '';

/**
 * Converts a string value into Title Case.
 * @param value The string value to convert.
 * @returns A string converted to Title Case.
 * @example
 * toTitleCase('the QUICK brown fox'); // 'The Quick Brown Fox'
 */
export const toTitleCase = (value: string): string =>
  value.replace(/\w\S*/g, (text) => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase());

/**
 * Converts a string value into a slug, meeting the following requirements:
 * - lowercase
 * - removes accents/diacritics
 * - replaces spaces and separators with "-"
 * - removes invalid URL characters
 * - collapses repeated "-"
 * - trims leading/trailing "-"
 * @param value The string value to convert.
 * @returns A string converted to a slug.
 * @example
 * toSlug('Héllo, World! 2026'); // 'hello-world-2026'
 * @throws
 * - UNABLE_TO_SLUGIFY_STRING: if the resulting slug is empty after processing the input string
 */
export const toSlug = (value: string): string => {
  const slug = value
    .normalize('NFKD') // separate accents from letters
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '') // remove apostrophes
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric runs with "-"
    .replace(/-+/g, '-') // collapse multiple "-"
    .replace(/^-|-$/g, ''); // trim "-" from start/end
  if (slug.length === 0) {
    throw new Exception(`Failed to slugify the string '${value}': the resulting slug is empty.`, {
      code: ERRORS.UNABLE_TO_SLUGIFY_STRING,
    });
  }
  return slug;
};

/**
 * Truncates a string to a specified length and appends an ellipsis if it exceeds that length.
 * @param text The string value to truncate.
 * @param maxLength The maximum length of the string before truncation.
 * @returns A string truncated to the specified length with an ellipsis if necessary.
 * @example
 * truncateText('The quick brown fox jumps', 12); // 'The quick...'
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
};

/**
 * Masks the middle of a string, keeping a specified number of visible characters at the start and
 * end.
 * @param text The string value to mask.
 * @param visibleChars The number of characters to keep visible at the start and end of the string.
 * @param mask? An optional string to use as the mask. Defaults to '...'.
 * @returns A string with the middle masked, keeping the specified number of visible characters at the start.
 * @example
 * maskMiddle('0x1234567890abcdef', 4); // '0x12...cdef'
 */
export const maskMiddle = (text: string, visibleChars: number, mask: string = '...'): string => {
  if (text.length <= visibleChars * 2) {
    return text;
  }
  return `${text.slice(0, visibleChars)}${mask}${text.slice(-visibleChars)}`;
};

/**
 * Normalizes a query string by removing control characters, zero-width characters, and extra spaces,
 * then converts it to lowercase. Optionally, it can truncate the string to a specified maximum length.
 * @param query The query string to normalize.
 * @param maxLength? The optional maximum length of the normalized query string.
 * @returns The normalized query string.
 * @example
 * normalizeQuery('  Héllo   WORLD  '); // 'héllo world'
 */
export const normalizeQuery = (query: string, maxLength?: number): string => {
  const normalized = query
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
};

/**
 * Converts any value into a string. If the value is an object or an array, it will be stringified
 * with JSON.stringify.
 * @param value The value to convert into a string.
 * @param jsonIndent? The number of spaces to use for indentation in the JSON string. Defaults to 0.
 * @returns A string representation of the value.
 * @example
 * stringifyValue({ id: 1 }); // '{"id":1}'
 * stringifyValue(42); // '42'
 * stringifyValue(null); // 'null'
 */
export const stringifyValue = (value: unknown, jsonIndent: number = 0): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (isObjectValid(value, true) || isArrayValid(value, true)) {
    try {
      return JSON.stringify(value, null, jsonIndent);
    } catch {
      // values JSON can't serialize, such as circular ones, fall back to String below
    }
  }
  return String(value);
};

/**
 * Applies substitutions to a string based on a provided object. The string can contain placeholders
 * in the format of {{key}}, which will be replaced by the corresponding value from the substitutions
 * object. If a placeholder does not have a corresponding key in the substitutions object, it will
 * remain unchanged in the output string.
 * @param input The input string containing placeholders in the format of {{key}}.
 * @param substitutions? An object containing key-value pairs for substitutions. The keys should
 * match the placeholders in the input string, without the curly braces.
 * @param options? An optional object containing additional options for substitutions.
 * @returns A string with the placeholders replaced by their corresponding values from the substitutions object.
 * @example
 * applySubstitutions('Hi {{name}}, you have {{count}} messages.', { name: 'Ada', count: 3 }); // 'Hi Ada, you have 3 messages.'
 */
export const applySubstitutions = (
  input: string,
  substitutions: Record<string, unknown> = {},
  options: ISubstitutionOptions = {
    jsonIndent: 0,
  },
): string =>
  input.replace(/{{(.*?)}}/g, (match: string, key: string): string =>
    isStringValid(key) && key in substitutions
      ? stringifyValue(substitutions[key], options.jsonIndent)
      : match,
  );
