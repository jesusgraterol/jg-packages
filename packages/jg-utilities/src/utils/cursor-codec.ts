import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IJsonValue } from '../shared/types.js';
import { decodeCursor, encodeCursor, type ICursorValue } from '../transformers/index.js';

import { isEqual } from './collections.js';
import type { ICursorCodec, ICursorCodecOptions } from './types.js';

// the longest cursor a codec encodes or decodes unless it sets its own maxLength
const DEFAULT_MAX_CURSOR_LENGTH = 2048;

// why a codec refused a cursor: its encoding, its payload's shape, or the list it came from
type IInvalidCursorReason = 'format' | 'schema' | 'scope';

/**
 * Builds the error decode throws for a cursor it refuses.
 * @param reason Why the cursor was refused.
 * @param cause The error underneath, if any.
 * @returns The error.
 */
const createInvalidCursorError = (reason: IInvalidCursorReason, cause?: unknown): Exception =>
  new Exception('The cursor is not valid for this list.', {
    code: ERRORS.INVALID_CURSOR,
    data: { reason },
    ...(cause === undefined ? {} : { cause }),
  });

/**
 * Checks the default scope rule: every key of the scope equals the payload's, compared like
 * `isEqual`, with null and undefined counting as the same value.
 * @param payload The decoded payload.
 * @param scope The list's scope, such as its filters and sort.
 * @returns Whether the payload belongs to the scope.
 */
const matchesEveryScopeKey = (payload: object, scope: object): boolean =>
  Object.entries(scope).every(([key, value]) =>
    isEqual((payload as Record<string, unknown>)[key] ?? null, value ?? null),
  );

/**
 * Creates a codec for a list's pagination cursors: `encode` validates a continuation, such as the
 * last row's sort keys and the list's filters, with the schema and encodes it as an opaque
 * base64url cursor; `decode` reverses that for a cursor a client sent, and accepts it only for the
 * list it came from. Without `matchesScope`, every key of the scope must equal the payload's.
 *
 * `decode` returns undefined for a missing cursor, meaning the first page, and throws
 * `INVALID_CURSOR` for any cursor it refuses, with `data.reason` saying whether its encoding, its
 * shape, or its scope was wrong, and the schema's own error, if any, as `cause`: for a client, a
 * cursor that fails its schema is the same mistake as a malformed one.
 * @param options The schema, the longest cursor, and the scope rule.
 * @returns The codec.
 * @example
 * import { createCursorCodec } from 'jg-utilities';
 *
 * type IPostCursor = { authorId: string; lastId: number };
 * const isPostCursor = (value: unknown): value is IPostCursor =>
 *   typeof value === 'object' && value !== null && 'authorId' in value && 'lastId' in value;
 *
 * const postCursors = createCursorCodec<IPostCursor, { authorId: string }>({
 *   schema: {
 *     parse: (value) => {
 *       if (!isPostCursor(value)) {
 *         throw new TypeError('Not a post cursor.');
 *       }
 *       return value;
 *     },
 *   },
 * });
 * const cursor = postCursors.encode({ authorId: 'ada', lastId: 42 });
 * postCursors.decode(cursor, { authorId: 'ada' }); // => { authorId: 'ada', lastId: 42 }
 * postCursors.decode(undefined, { authorId: 'ada' }); // => undefined
 * @throws
 * - CURSOR_TOO_LONG: The cursor is longer than the codec's maximum length.
 * - INVALID_CURSOR: The cursor is not valid for this list.
 */
export const createCursorCodec = <
  TPayload extends { [key: string]: IJsonValue },
  TScope extends object = Partial<TPayload>,
>({
  schema,
  maxLength = DEFAULT_MAX_CURSOR_LENGTH,
  matchesScope = matchesEveryScopeKey,
}: ICursorCodecOptions<TPayload, TScope>): ICursorCodec<TPayload, TScope> => ({
  encode: (payload) => {
    const cursor = encodeCursor(schema.parse(payload));
    if (cursor.length > maxLength) {
      throw new Exception("The cursor is longer than the codec's maximum length.", {
        code: ERRORS.CURSOR_TOO_LONG,
        data: { length: cursor.length, maxLength },
      });
    }
    return cursor;
  },
  decode: (cursor, scope) => {
    if (cursor === undefined || cursor === null) {
      return undefined;
    }
    let value: ICursorValue;
    try {
      value = decodeCursor(cursor, maxLength);
    } catch (error) {
      throw createInvalidCursorError('format', error);
    }
    let payload: TPayload;
    try {
      payload = schema.parse(value);
    } catch (error) {
      throw createInvalidCursorError('schema', error);
    }
    if (!matchesScope(payload, scope)) {
      throw createInvalidCursorError('scope');
    }
    return payload;
  },
});
