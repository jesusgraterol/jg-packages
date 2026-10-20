import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { isArrayValid, isObjectValid, isStringValid } from '../validations/index.js';

import type { ISubstitutionOptions } from './types.js';
import { validateByteLimit } from './validations.js';

/**
 * Capitalizes the first letter of a string and returns the new value.
 * @param value The string value to capitalize.
 * @returns A string with the first letter capitalized.
 * @example
 * import { capitalizeFirst } from 'jg-utilities';
 *
 * capitalizeFirst('hello world'); // => 'Hello world'
 */
export const capitalizeFirst = (value: string): string =>
  value.length > 0 ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : '';

/**
 * Converts a string value into Title Case.
 * @param value The string value to convert.
 * @returns A string converted to Title Case.
 * @example
 * import { toTitleCase } from 'jg-utilities';
 *
 * toTitleCase('the QUICK brown fox'); // => 'The Quick Brown Fox'
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
 * import { toSlug } from 'jg-utilities';
 *
 * toSlug('Héllo, World! 2026'); // => 'hello-world-2026'
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
 * import { truncateText } from 'jg-utilities';
 *
 * truncateText('The quick brown fox jumps', 12); // => 'The quick...'
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
};

/**
 * Gives the number of bytes a code point takes in UTF-8: 4 for a surrogate pair, and up to 3 for a
 * single UTF-16 code unit. A lone surrogate counts as 3, the size of the U+FFFD that `TextEncoder`
 * writes for it.
 * @param codePoint The code point, as the string iterating a string gives.
 * @returns From 1 to 4.
 */
const getUtf8ByteLength = (codePoint: string): number => {
  if (codePoint.length === 2) {
    return 4;
  }
  const codeUnit = codePoint.charCodeAt(0);
  if (codeUnit < 0x80) {
    return 1;
  }
  return codeUnit < 0x800 ? 2 : 3;
};

/**
 * Shortens a string to the longest prefix of whole code points that fits a number of UTF-8 bytes,
 * such as a push notification's body under the provider's payload limit. A character made of
 * several code points, such as an emoji with a skin tone, can lose its last ones, but a code point
 * is never split.
 * @param text The string.
 * @param maxBytes The most bytes the result may take in UTF-8, a non-negative safe integer.
 * @returns The string itself when it fits, otherwise its longest prefix that does.
 * @example
 * import { truncateToUtf8Bytes } from 'jg-utilities';
 *
 * truncateToUtf8Bytes('Hello, world', 5); // => 'Hello'
 * truncateToUtf8Bytes('café au lait', 4); // => 'caf'
 * truncateToUtf8Bytes('café au lait', 5); // => 'café'
 * @throws
 * - INVALID_BYTE_LIMIT: The byte limit must be a non-negative safe integer.
 */
export const truncateToUtf8Bytes = (text: string, maxBytes: number): string => {
  validateByteLimit(maxBytes);
  // a UTF-16 code unit never takes more than 3 bytes, so a string this short always fits
  if (text.length * 3 <= maxBytes) {
    return text;
  }
  let byteLength = 0;
  let end = 0;
  for (const codePoint of text) {
    byteLength += getUtf8ByteLength(codePoint);
    if (byteLength > maxBytes) {
      return text.slice(0, end);
    }
    end += codePoint.length;
  }
  return text;
};

/**
 * Counts the bytes a string takes in UTF-8, as `TextEncoder` writes it, without encoding it, and
 * stops once the count passes `maxBytes`, so measuring a long string against a small limit costs
 * little. A lone surrogate counts as 3 bytes, the size of the U+FFFD that replaces it.
 * @param text The string.
 * @param maxBytes? The limit, a non-negative safe integer. Without it, the whole string is counted.
 * @returns The exact count when it's at most `maxBytes`, otherwise a number above it.
 * @example
 * import { countUtf8Bytes } from 'jg-utilities';
 *
 * countUtf8Bytes('café'); // => 5
 * countUtf8Bytes('😀'); // => 4
 * countUtf8Bytes('a'.repeat(1_000_000), 10) > 10; // => true
 * @throws
 * - INVALID_BYTE_LIMIT: The byte limit must be a non-negative safe integer.
 */
export const countUtf8Bytes = (text: string, maxBytes?: number): number => {
  if (maxBytes !== undefined) {
    validateByteLimit(maxBytes);
  }
  const limit = maxBytes ?? Number.POSITIVE_INFINITY;
  let bytes = 0;
  for (let index = 0; index < text.length && bytes <= limit; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00
    ) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
};

/**
 * Compares two strings by Unicode code point, the order of UTF-8 bytes and of most other languages'
 * strings, where `<` and the default sort compare UTF-16 code units, which put characters above
 * U+FFFF, such as emoji, before U+E000 to U+FFFF. It allocates nothing, so it suits sorting large
 * lists. A lone surrogate compares as its own code point.
 * @param left The first string.
 * @param right The second string.
 * @returns A negative number when `left` comes first, a positive one when `right` does, and 0 when
 * they're equal.
 * @example
 * import { compareCodePoints } from 'jg-utilities';
 *
 * ['😀', '\uff5e', 'a'].sort(compareCodePoints); // => ['a', '\uff5e', '😀']
 * ['😀', '\uff5e', 'a'].sort(); // => ['a', '😀', '\uff5e']
 */
export const compareCodePoints = (left: string, right: string): number => {
  let index = 0;
  while (index < left.length && index < right.length) {
    // equal code points take the same number of code units, so one index walks both strings
    const leftCodePoint = left.codePointAt(index) as number;
    const rightCodePoint = right.codePointAt(index) as number;
    if (leftCodePoint !== rightCodePoint) {
      return leftCodePoint < rightCodePoint ? -1 : 1;
    }
    index += leftCodePoint > 0xffff ? 2 : 1;
  }
  return Math.sign(left.length - right.length);
};

/**
 * Masks the middle of a string, keeping a specified number of visible characters at the start and
 * end.
 * @param text The string value to mask.
 * @param visibleChars The number of characters to keep visible at the start and end of the string.
 * @param mask? An optional string to use as the mask. Defaults to '...'.
 * @returns A string with the middle masked, keeping the specified number of visible characters at the start.
 * @example
 * import { maskMiddle } from 'jg-utilities';
 *
 * maskMiddle('0x1234567890abcdef', 4); // => '0x12...cdef'
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
 * import { normalizeQuery } from 'jg-utilities';
 *
 * normalizeQuery('  Héllo   WORLD  '); // => 'héllo world'
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
 * import { stringifyValue } from 'jg-utilities';
 *
 * stringifyValue({ id: 1 }); // => '{"id":1}'
 * stringifyValue(42); // => '42'
 * stringifyValue(null); // => 'null'
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
 * import { applySubstitutions } from 'jg-utilities';
 *
 * applySubstitutions('Hi {{name}}, you have {{count}} messages.', { name: 'Ada', count: 3 }); // => 'Hi Ada, you have 3 messages.'
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

/**
 * Escapes text for HTML, so it shows as written instead of becoming markup, such as a name in an
 * email template or a Telegram message. It's safe in element content and quoted attribute values,
 * not in a URL, a script, or a style.
 * @param text The text.
 * @returns The escaped text.
 * @example
 * import { escapeHtml } from 'jg-utilities';
 *
 * escapeHtml('<b>"Tom" & Jerry\'s</b>'); // => '&lt;b&gt;&quot;Tom&quot; &amp; Jerry&#39;s&lt;/b&gt;'
 */
export const escapeHtml = (text: string): string =>
  // the ampersand goes first, so the entities added after it aren't escaped again
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * Picks the singular or plural form of a word for a count, such as "1 file" and "3 files".
 * @param count The count.
 * @param singular The word for exactly one.
 * @param plural The word for any other count. Defaults to the singular with an "s".
 * @returns The word alone, so other words can sit between it and the count.
 * @example
 * import { pluralize } from 'jg-utilities';
 *
 * pluralize(1, 'file'); // => 'file'
 * pluralize(0, 'file'); // => 'files'
 * pluralize(2, 'entry', 'entries'); // => 'entries'
 */
export const pluralize = (
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string => (count === 1 ? singular : plural);
