// @vitest-environment node
import { DEFAULT_MESSAGE, Exception } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { buildMessage, serializeObject } from './utilities.js';

describe('buildMessage', () => {
  test.each([
    ['an Error', new Error('The upload failed.'), 'The upload failed.'],
    [
      'an Exception, prefixed with its code',
      new Exception('The user does not exist.', { code: 'NOT_FOUND' }),
      'NOT_FOUND: The user does not exist.',
    ],
    ['a message with null characters', new Error('a\0b\0'), 'ab'],
    ['a message of null characters only', new Error('\0\0'), DEFAULT_MESSAGE],
    ['a string', 'plain text', 'plain text'],
  ])('buildMessage(%s) -> %s', (_, error, expected) => {
    expect(buildMessage(error, 8_192)).toBe(expected);
  });

  test('cuts a long message by code points, ending in the suffix, to exactly the limit', () => {
    const message = buildMessage(new Error(`${'😀'.repeat(20)}abc`), 16);

    expect([...message]).toHaveLength(16);
    expect(message).toBe(`😀😀😀😀 [truncated]`);
    // no surrogate pair was split, so the message survives a UTF-8 round trip
    expect(Buffer.from(message, 'utf8').toString('utf8')).toBe(message);
  });

  test('keeps a message of exactly the limit whole', () => {
    expect(buildMessage(new Error('😀'.repeat(16)), 16)).toBe('😀'.repeat(16));
  });
});

describe('serializeObject', () => {
  test.each([
    ['null', null],
    ['an array', [1, 2]],
    ['a string', 'text'],
    ['undefined', undefined],
  ])('gives null for %s, which is not an object', (_, value) => {
    expect(serializeObject(value, 1_024)).toBeNull();
  });

  test('leaves out a reference back to an object the value is inside, keeping repeated ones', () => {
    const shared = { id: 1 };
    const value: Record<string, unknown> = { a: shared, b: shared, list: [shared] };
    value['self'] = value;
    (shared as Record<string, unknown>)['parent'] = value;

    expect(JSON.parse(serializeObject(value, 1_024) ?? '')).toStrictEqual({
      a: { id: 1 },
      b: { id: 1 },
      list: [{ id: 1 }],
    });
  });

  test("removes null characters from keys and strings, and uses toJSON and a BigInt's digits", () => {
    expect(
      JSON.parse(
        serializeObject(
          {
            'na\0me': 'Ada\0',
            at: new Date('2026-01-01T00:00:00.000Z'),
            big: 9_007_199_254_740_993n,
            nested: { values: ['x\0'] },
          },
          1_024,
        ) ?? '',
      ),
    ).toStrictEqual({
      name: 'Ada',
      at: '2026-01-01T00:00:00.000Z',
      big: '9007199254740993',
      nested: { values: ['x'] },
    });
  });

  test('gives null for an object over the bytes allowed, and keeps one exactly at them', () => {
    const value = { text: 'é'.repeat(10) };
    const json = JSON.stringify(value);
    const bytes = Buffer.byteLength(json, 'utf8');

    expect(serializeObject(value, bytes)).toBe(json);
    expect(serializeObject(value, bytes - 1)).toBeNull();
  });

  test('gives null for data nested too deeply to copy', () => {
    let deep: Record<string, unknown> = {};
    const root = deep;
    for (let depth = 0; depth < 200_000; depth += 1) {
      const next = {};
      deep['next'] = next;
      deep = next;
    }

    expect(serializeObject(root, Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('keeps data nested 256 levels deep, and gives null for data one level deeper', () => {
    const nest = (levels: number, innermost: unknown): Record<string, unknown> => {
      let value: Record<string, unknown> = { innermost };
      for (let level = 1; level < levels; level += 1) {
        value = { next: value };
      }
      return value;
    };
    const wrap = (innermost: string) => `${'{"next":'.repeat(255)}${innermost}${'}'.repeat(255)}`;

    expect(serializeObject(nest(256, 1), Number.POSITIVE_INFINITY)).toBe(wrap('{"innermost":1}'));
    expect(serializeObject(nest(257, 1), Number.POSITIVE_INFINITY)).toBeNull();
    // a value toJSON turns into a string takes no level, as in JSON.stringify, and an array takes one
    expect(
      serializeObject(nest(256, new Date('2026-01-01T00:00:00.000Z')), Number.POSITIVE_INFINITY),
    ).toBe(wrap('{"innermost":"2026-01-01T00:00:00.000Z"}'));
    expect(serializeObject(nest(256, []), Number.POSITIVE_INFINITY)).toBeNull();
  });
});
