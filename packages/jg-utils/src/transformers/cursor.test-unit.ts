import { getErrorCode } from 'jg-exception';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { encodeBase64Url } from './base64url.js';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('encodeCursor and decodeCursor', () => {
  test.each([
    [{ createdAt: '2026-10-17T08:30:00.000Z', id: 42 }],
    [{ nested: { tags: ['a', 'b'], ok: true, none: null } }],
    [['2026-10-17', 7]],
    [{ text: 'ünïcödé and emoji 🙂' }],
  ])('decodeCursor(encodeCursor(%o)) -> the same value', (value) => {
    const cursor = encodeCursor(value);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toStrictEqual(value);
  });
});

describe('decodeCursor', () => {
  test.each([
    ['', 'an empty cursor'],
    ['abc$', 'a character outside base64url'],
    ['eyJh=', 'padding'],
    ['a b', 'a space'],
  ])('decodeCursor(%o) -> throws INVALID_CURSOR for %s', (cursor) => {
    expectToThrowCode(() => decodeCursor(cursor), ERRORS.INVALID_CURSOR);
  });

  test('rejects a cursor longer than the limit before decoding it', () => {
    const cursor = encodeCursor({ padding: 'x'.repeat(100) });

    expect(decodeCursor(cursor, cursor.length)).toStrictEqual({ padding: 'x'.repeat(100) });
    expectToThrowCode(() => decodeCursor(cursor, cursor.length - 1), ERRORS.INVALID_CURSOR);
    expectToThrowCode(() => decodeCursor('a'.repeat(2049)), ERRORS.INVALID_CURSOR);
  });

  test('wraps a decoding failure in INVALID_CURSOR and keeps it as the cause', () => {
    const cursor = encodeBase64Url('not json');

    expectToThrowCode(
      () => decodeCursor(cursor),
      ERRORS.INVALID_CURSOR,
      'The cursor is not a valid encoded value',
    );
    let caught: unknown;
    try {
      decodeCursor(cursor);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(getErrorCode((caught as Error).cause)).toBe(ERRORS.UNABLE_TO_DESERIALIZE_JSON);
  });

  test.each([['"just a string"'], ['42'], ['null']])(
    'decodeCursor(encoded %s) -> throws INVALID_CURSOR, because a cursor holds an object or an array',
    (json) => {
      expectToThrowCode(() => decodeCursor(encodeBase64Url(json)), ERRORS.INVALID_CURSOR);
    },
  );

  test('rejects a non-canonical encoding of the same JSON', () => {
    const cursor = encodeCursor({ a: 1 });
    const altered = `${cursor.slice(0, -1)}${cursor.at(-1) === 'Q' ? 'R' : 'Q'}`;

    expectToThrowCode(() => decodeCursor(altered), ERRORS.INVALID_CURSOR);
  });
});
