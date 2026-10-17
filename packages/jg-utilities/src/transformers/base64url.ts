import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import { BASE64URL_PATTERN } from './constants.js';
import { bytesToBinaryString } from './utilities.js';

/**
 * Encodes a string as UTF-8 base64url without padding. For ASCII input, the output equals the
 * btoa-based and Buffer-based base64url encodings.
 * @param value The string to encode.
 * @returns The base64url encoding of the string's UTF-8 bytes.
 * @example
 * import { encodeBase64Url } from 'jg-utilities';
 *
 * encodeBase64Url('{"page":2}'); // => 'eyJwYWdlIjoyfQ'
 */
export const encodeBase64Url = (value: string): string =>
  btoa(bytesToBinaryString(new TextEncoder().encode(value)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

/**
 * Decodes a base64url value, without padding, into the UTF-8 string it encodes. Only the canonical
 * encoding of a string is accepted, so every string has exactly one valid encoding.
 * @param value The base64url value to decode.
 * @returns The decoded string.
 * @example
 * import { decodeBase64Url } from 'jg-utilities';
 *
 * decodeBase64Url('eyJwYWdlIjoyfQ'); // => '{"page":2}'
 * @throws
 * - INVALID_BASE64URL: if the value isn't a string of base64url characters with a valid length.
 * - INVALID_BASE64URL: if the decoded bytes aren't valid UTF-8.
 * - INVALID_BASE64URL: if the value isn't the canonical encoding of its result.
 */
export const decodeBase64Url = (value: string): string => {
  if (typeof value !== 'string' || !BASE64URL_PATTERN.test(value) || value.length % 4 === 1) {
    throw new Exception('The value is not a valid base64url string without padding.', {
      code: ERRORS.INVALID_BASE64URL,
    });
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  let decoded: string;
  try {
    // ignoreBOM keeps a leading U+FEFF, so strings that start with one still round-trip
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (error) {
    throw new Exception("The base64url value doesn't encode valid UTF-8.", {
      code: ERRORS.INVALID_BASE64URL,
      cause: error,
    });
  }
  if (encodeBase64Url(decoded) !== value) {
    throw new Exception('The value is not the canonical base64url encoding of its result.', {
      code: ERRORS.INVALID_BASE64URL,
    });
  }
  return decoded;
};
