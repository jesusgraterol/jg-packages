// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { parseJson, pruneJson, stringifyJson, stringifyJsonDeterministically } from './json.js';

describe('stringifyJson', () => {
  test.each([[undefined], [null], [''], ['hello world'], [true], [123], [NaN]])(
    'stringifyJson(%o) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => stringifyJson(value), ERRORS.UNSUPPORTED_DATA_TYPE);
    },
  );

  test.each([
    [{ c: 6, b: [4, 5], a: 3, z: null }, '{"c":6,"b":[4,5],"a":3,"z":null}'],
    [{ a: 3, z: undefined }, '{"a":3}'],
    [[4, undefined, 6], '[4,null,6]'],
    [{ a: 3, z: '' }, '{"a":3,"z":""}'],
    [[4, '', 6], '[4,"",6]'],
    [{ c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 }, '{"c":8,"b":[{"z":6,"y":5,"x":4},7],"a":3}'],
    [{ b: { x: 1 }, a: { x: 1 } }, '{"b":{"x":1},"a":{"x":1}}'],
  ])('stringifyJson(%j) -> %s', (value, expected) => {
    expect(stringifyJson(value)).toBe(expected);
  });
});

// values JSON.stringify can't serialize, or turns into nothing
const circular: Record<string, unknown> = {};
circular['self'] = circular;
const UNSERIALIZABLE: [string, unknown][] = [
  ['an object that refers back to itself', circular],
  ['a BigInt', { id: 1n }],
  ['an object whose toJSON returns undefined', { toJSON: () => undefined }],
];

describe('stringifyJson and stringifyJsonDeterministically on values JSON cannot hold', () => {
  test.each(UNSERIALIZABLE)('stringifyJson throws UNABLE_TO_SERIALIZE_JSON for %s', (_, value) => {
    expectToThrowCode(() => stringifyJson(value), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });

  test.each(UNSERIALIZABLE)(
    'stringifyJsonDeterministically throws UNABLE_TO_SERIALIZE_JSON for %s',
    (_, value) => {
      expectToThrowCode(
        () => stringifyJsonDeterministically(value),
        ERRORS.UNABLE_TO_SERIALIZE_JSON,
      );
    },
  );

  test("keeps JSON's error as the cause", () => {
    let thrown: unknown;
    try {
      stringifyJson({ id: 1n });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: ERRORS.UNABLE_TO_SERIALIZE_JSON });
    expect((thrown as { cause?: unknown }).cause).toBeInstanceOf(TypeError);
  });
});

describe('stringifyJsonDeterministically', () => {
  test.each([[undefined], [null], [''], ['hello world'], [true], [123], [NaN]])(
    'stringifyJsonDeterministically(%o) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => stringifyJsonDeterministically(value), ERRORS.UNSUPPORTED_DATA_TYPE);
    },
  );

  test.each([
    [{ c: 6, b: [4, 5], a: 3, z: null }, '{"a":3,"b":[4,5],"c":6,"z":null}'],
    [{ a: 3, z: undefined }, '{"a":3}'],
    [[4, undefined, 6], '[4,null,6]'],
    [{ a: 3, z: '' }, '{"a":3,"z":""}'],
    [[4, '', 6], '[4,"",6]'],
    [{ c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 }, '{"a":3,"b":[{"x":4,"y":5,"z":6},7],"c":8}'],
    [{ b: { x: 1 }, a: { x: 1 } }, '{"a":{"x":1},"b":{"x":1}}'],
    [{ b: { a: 1 }, c: { a: 1 } }, '{"b":{"a":1},"c":{"a":1}}'],
  ])('stringifyJsonDeterministically(%j) -> %s', (value, expected) => {
    expect(stringifyJsonDeterministically(value)).toBe(expected);
  });
});

describe('parseJson', () => {
  test.each([[undefined], [null], [''], [true], [123], [NaN]])(
    'parseJson(%s) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => parseJson(value as string), ERRORS.UNSUPPORTED_DATA_TYPE);
    },
  );
  test.each([['hello world']])('parseJson(%s) -> throws UNABLE_TO_DESERIALIZE_JSON', (value) => {
    expectToThrowCode(() => parseJson(value), ERRORS.UNABLE_TO_DESERIALIZE_JSON);
  });

  test.each([
    ['{"c":6,"b":[4,5],"a":3,"z":null}', { c: 6, b: [4, 5], a: 3, z: null }],
    ['{"a":3}', { a: 3 }],
    ['[4,null,6]', [4, null, 6]],
    ['{"a":3,"z":""}', { a: 3, z: '' }],
    ['[4,"",6]', [4, '', 6]],
    ['{"c":8,"b":[{"z":6,"y":5,"x":4},7],"a":3}', { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 }],
    ['{"b":{"x":1},"a":{"x":1}}', { b: { x: 1 }, a: { x: 1 } }],
  ])('parseJson(%s) -> %o', (value, expected) => {
    expect(parseJson(value)).toStrictEqual(expected);
  });
});

describe('pruneJson', () => {
  test.each([
    [null, null],
    [undefined, null],
    [123, 123],
    ['hello', 'hello'],
    [[], null],
    [{}, null],
    [
      { a: null, b: undefined, c: {}, d: [], e: 0, f: '', g: { h: null, i: 5 }, j: [null, 6] },
      { e: 0, f: '', g: { i: 5 }, j: [6] },
    ],
    [
      [null, undefined, {}, [], 0, '', { a: null, b: 3 }, [null, 4]],
      [0, '', { b: 3 }, [4]],
    ],
    [
      {
        a: { b: { c: { d: {} }, x: undefined } },
        z: null,
        y: [[], [null, { foo: { x: { a: null } } }], {}],
      },
      null,
    ],
    [
      {
        a: { b: { c: { d: { z: undefined, x: [], p: { a: 1 } } }, x: undefined } },
        z: null,
        y: [[], [null, { foo: { x: { a: null } } }], {}],
      },
      { a: { b: { c: { d: { p: { a: 1 } } } } } },
    ],
  ])('pruneJson(%o) -> %o', (input, expected) => {
    expect(pruneJson(input as never)).toStrictEqual(expected);
  });
});
