import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IJSONValue } from '../shared/types.js';

import { decodeBase64Url, encodeBase64Url } from './base64url.js';
import { parseJSON, stringifyJSON } from './json.js';

// the JSON a cursor can hold: an object or an array, as pagination continuations are
export type ICursorValue = { [key: string]: IJSONValue } | IJSONValue[];

// the characters a cursor can hold
const CURSOR_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Encodes a pagination continuation, such as the sort keys of the last row, as an opaque cursor:
 * its JSON in base64url, safe for URLs and query strings.
 * @param value The object or array to encode.
 * @returns The cursor.
 * @example
 * encodeCursor({ createdAt: '2026-10-17T08:30:00.000Z', id: 42 }); // 'eyJjcmVhdGVkQXQi...'
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the value isn't an object or an array
 * - UNABLE_TO_SERIALIZE_JSON: if the value contains data that cannot be serialized
 */
export const encodeCursor = (value: ICursorValue): string => encodeBase64Url(stringifyJSON(value));

/**
 * Decodes a cursor made by `encodeCursor`. The cursor comes from a client, so it's validated
 * before decoding: a non-empty base64url string no longer than `maxLength`. The caller still
 * validates the decoded value's shape, such as with a schema.
 * @param cursor The cursor to decode.
 * @param maxLength The longest cursor accepted, in characters.
 * @returns The decoded object or array.
 * @example
 * const continuation = decodeCursor(searchParams.get('cursor') ?? '');
 * @throws
 * - INVALID_CURSOR: The cursor is not a valid encoded value.
 */
export const decodeCursor = (cursor: string, maxLength: number = 2048): ICursorValue => {
  if (typeof cursor !== 'string' || cursor.length > maxLength || !CURSOR_PATTERN.test(cursor)) {
    throw new Exception(
      `The cursor is not a valid encoded value: it must be a base64url string of at most ${maxLength} characters.`,
      { code: ERRORS.INVALID_CURSOR },
    );
  }
  try {
    return parseJSON<ICursorValue>(decodeBase64Url(cursor));
  } catch (error) {
    throw new Exception('The cursor is not a valid encoded value.', {
      code: ERRORS.INVALID_CURSOR,
      cause: error,
    });
  }
};
