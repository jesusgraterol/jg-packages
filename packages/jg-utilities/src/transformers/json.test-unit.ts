// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { parseJSON, pruneJSON, stringifyJSON, stringifyJSONDeterministically } from './json.js';

describe('stringifyJSON', () => {
  test.each([[undefined], [null], [''], ['hello world'], [true], [123], [NaN]])(
    'stringifyJSON(%o) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => stringifyJSON(value), ERRORS.UNSUPPORTED_DATA_TYPE);
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
  ])('stringifyJSON(%j) -> %s', (value, expected) => {
    expect(stringifyJSON(value)).toBe(expected);
  });
});

describe('stringifyJSONDeterministically', () => {
  test.each([[undefined], [null], [''], ['hello world'], [true], [123], [NaN]])(
    'stringifyJSONDeterministically(%o) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => stringifyJSONDeterministically(value), ERRORS.UNSUPPORTED_DATA_TYPE);
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
  ])('stringifyJSONDeterministically(%j) -> %s', (value, expected) => {
    expect(stringifyJSONDeterministically(value)).toBe(expected);
  });
});

describe('parseJSON', () => {
  test.each([[undefined], [null], [''], [true], [123], [NaN]])(
    'parseJSON(%s) -> throws UNSUPPORTED_DATA_TYPE',
    (value) => {
      expectToThrowCode(() => parseJSON(value as string), ERRORS.UNSUPPORTED_DATA_TYPE);
    },
  );
  test.each([['hello world']])('parseJSON(%s) -> throws UNABLE_TO_DESERIALIZE_JSON', (value) => {
    expectToThrowCode(() => parseJSON(value), ERRORS.UNABLE_TO_DESERIALIZE_JSON);
  });

  test.each([
    ['{"c":6,"b":[4,5],"a":3,"z":null}', { c: 6, b: [4, 5], a: 3, z: null }],
    ['{"a":3}', { a: 3 }],
    ['[4,null,6]', [4, null, 6]],
    ['{"a":3,"z":""}', { a: 3, z: '' }],
    ['[4,"",6]', [4, '', 6]],
    ['{"c":8,"b":[{"z":6,"y":5,"x":4},7],"a":3}', { c: 8, b: [{ z: 6, y: 5, x: 4 }, 7], a: 3 }],
    ['{"b":{"x":1},"a":{"x":1}}', { b: { x: 1 }, a: { x: 1 } }],
  ])('parseJSON(%s) -> %o', (value, expected) => {
    expect(parseJSON(value)).toStrictEqual(expected);
  });
});

describe('pruneJSON', () => {
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
  ])('pruneJSON(%o) -> %o', (input, expected) => {
    expect(pruneJSON(input as never)).toStrictEqual(expected);
  });
});
