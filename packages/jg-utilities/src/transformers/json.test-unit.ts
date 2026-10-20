// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import {
  measureJsonBytes,
  parseJson,
  pruneJson,
  stringifyJson,
  stringifyJsonDeterministically,
} from './json.js';

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

describe('stringifyJsonDeterministically key order', () => {
  test('orders keys by UTF-16 code unit, as the RFC 8785 example does', () => {
    expect(
      stringifyJsonDeterministically({
        '€': 'Euro Sign',
        '\r': 'Carriage Return',
        דּ: 'Hebrew Letter Dalet With Dagesh',
        '1': 'One',
        '😀': 'Emoji: Grinning Face',
        '\u0080': 'Control',
        ö: 'Latin Small Letter O With Diaeresis',
      }),
    ).toBe(
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
    );
  });

  test('sorts integer-like keys as text, where JavaScript objects put them first', () => {
    expect(stringifyJsonDeterministically({ b: 0, 10: 'ten', 9: 'nine', 1: 'one' })).toBe(
      '{"1":"one","10":"ten","9":"nine","b":0}',
    );
  });

  test('sorts a key above U+FFFF before one from U+E000, by its first code unit', () => {
    expect(stringifyJsonDeterministically({ '': 1, '😀': 2 })).toBe('{"😀":2,"":1}');
  });

  test('serializes an object it meets twice, outside a cycle, both times', () => {
    const shared = { b: 1, a: 2 };

    expect(stringifyJsonDeterministically({ y: shared, x: [shared] })).toBe(
      '{"x":[{"a":2,"b":1}],"y":{"a":2,"b":1}}',
    );
  });
});

describe('stringifyJsonDeterministically default mode', () => {
  test.each<[string, object, string]>([
    ['calls toJSON with its key', { when: new Date(0) }, '{"when":"1970-01-01T00:00:00.000Z"}'],
    [
      'passes toJSON the array index as a string',
      [{ toJSON: (key: string) => `at ${key}` }],
      '["at 0"]',
    ],
    [
      'leaves out undefined, functions, and symbols',
      { a: undefined, b: () => 1, c: Symbol('c'), d: 1 },
      '{"d":1}',
    ],
    ['writes null for them in arrays', [undefined, () => 1, Symbol('c')], '[null,null,null]'],
    // eslint-disable-next-line no-sparse-arrays
    ['writes null for holes', [1, , 3], '[1,null,3]'],
    ['writes null for non-finite numbers', [NaN, Infinity, -Infinity], '[null,null,null]'],
    ['writes -0 as 0', [-0], '[0]'],
    [
      'unwraps Number, String, and Boolean objects',
      [Object(1), Object('a'), Object(false)],
      '[1,"a",false]',
    ],
    ['ignores symbol keys', { [Symbol('hidden')]: 1, shown: 2 }, '{"shown":2}'],
    ['writes a Map as {}', { map: new Map([['a', 1]]) }, '{"map":{}}'],
  ])('%s', (_, value, expected) => {
    expect(stringifyJsonDeterministically(value)).toBe(expected);
    expect(JSON.parse(stringifyJsonDeterministically(value))).toStrictEqual(
      JSON.parse(JSON.stringify(value)),
    );
  });

  test('sorts the keys of what toJSON returns', () => {
    expect(stringifyJsonDeterministically({ value: { toJSON: () => ({ b: 1, a: 2 }) } })).toBe(
      '{"value":{"a":2,"b":1}}',
    );
  });

  test('throws UNABLE_TO_SERIALIZE_JSON for a cycle, naming its path', () => {
    const value: Record<string, unknown> = { list: [] };
    (value['list'] as unknown[]).push(value);

    expectToThrowCode(
      () => stringifyJsonDeterministically(value),
      ERRORS.UNABLE_TO_SERIALIZE_JSON,
      'the value at $.list[0] refers back to an object that contains it',
    );
  });

  test("keeps a toJSON's error as the cause", () => {
    const failure = new Error('toJSON failed');
    let thrown: unknown;
    try {
      stringifyJsonDeterministically({
        value: {
          toJSON: () => {
            throw failure;
          },
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: ERRORS.UNABLE_TO_SERIALIZE_JSON, cause: failure });
  });
});

describe('stringifyJsonDeterministically strict mode', () => {
  class Point {
    x = 1;
  }

  test.each<[string, unknown, string]>([
    ['an undefined property', { a: undefined }, '$.a is undefined'],
    ['undefined in an array', { list: [1, undefined] }, '$.list[1] is undefined'],
    ['NaN', { n: NaN }, '$.n is NaN'],
    ['Infinity', [Infinity], '$[0] is Infinity'],
    ['-Infinity', [-Infinity], '$[0] is -Infinity'],
    ['a BigInt', { id: 1n }, '$.id is a BigInt'],
    ['a symbol', { s: Symbol('s') }, '$.s is symbol'],
    ['a function', { 'a key': () => 1 }, '$["a key"] is function'],
    ['a Date', { when: new Date(0) }, '$.when is not a plain object'],
    ['a class instance', [new Point()], '$[0] is not a plain object'],
    ['a Map', { map: new Map() }, '$.map is not a plain object'],
    ['an object with toJSON', { value: { toJSON: () => 1 } }, '$.value.toJSON is function'],
    ['a symbol key', { [Symbol('hidden')]: 1 }, '$ has a symbol key'],
    // eslint-disable-next-line no-sparse-arrays
    ['a hole', [1, , 3], '$[1] is a hole in the array'],
  ])('throws UNABLE_TO_SERIALIZE_JSON for %s', (_, value, message) => {
    expectToThrowCode(
      () => stringifyJsonDeterministically(value, { strict: true }),
      ERRORS.UNABLE_TO_SERIALIZE_JSON,
      message,
    );
  });

  test('throws UNABLE_TO_SERIALIZE_JSON for a cycle', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;

    expectToThrowCode(
      () => stringifyJsonDeterministically(value, { strict: true }),
      ERRORS.UNABLE_TO_SERIALIZE_JSON,
      '$.self refers back',
    );
  });

  test('accepts plain data, objects without a prototype, and writes -0 as 0', () => {
    const bare = Object.assign(Object.create(null) as Record<string, unknown>, { b: [-0, null] });

    expect(
      stringifyJsonDeterministically({ z: 'last', a: true, nested: bare }, { strict: true }),
    ).toBe('{"a":true,"nested":{"b":[0,null]},"z":"last"}');
  });

  test('still refuses a value that is not an object or an array', () => {
    expectToThrowCode(
      () => stringifyJsonDeterministically('text', { strict: true }),
      ERRORS.UNSUPPORTED_DATA_TYPE,
    );
  });
});

describe('measureJsonBytes', () => {
  test.each<[string, unknown, number]>([
    ['null', null, 4],
    ['true', true, 4],
    ['false', false, 5],
    ['an integer', 12345, 5],
    ['a decimal', -1.5, 4],
    ['NaN, written as null', NaN, 4],
    ['-0, written as 0', -0, 1],
    ['a short escape', 'a\nb', 6],
    ['a control character', '\u0001', 8],
    ['a 2-byte character', 'é', 4],
    ['a 3-byte character', '€', 5],
    ['a surrogate pair', '😀', 6],
    ['a lone surrogate, written as an escape', '\ud800', 8],
    ['an object, leaving out undefined', { a: 1, b: undefined, é: 'x' }, 16],
    ['an array, writing null for undefined', [1, undefined, 'x'], 12],
    ['a Date, through toJSON', new Date(0), 26],
  ])('measures %s as JSON.stringify writes it', (_, value, bytes) => {
    expect(measureJsonBytes(value, 1024)).toBe(bytes);
    expect(measureJsonBytes(value, 1024)).toBe(
      new TextEncoder().encode(JSON.stringify(value)).length,
    );
  });

  test('returns the exact size when it equals the limit', () => {
    expect(measureJsonBytes({ a: 'bcd' }, 11)).toBe(11);
  });

  test('stops past the limit with a number above it', () => {
    const size = measureJsonBytes({ text: 'x'.repeat(1_000_000), more: ['y'] }, 100);

    expect(size).toBeGreaterThan(100);
    expect(size).toBeLessThan(1_000);
  });

  test.each([
    ['undefined', undefined],
    ['a function', () => 1],
    ['a symbol', Symbol('s')],
    ['an object whose toJSON returns undefined', { toJSON: () => undefined }],
    ['a BigInt', { id: 1n }],
  ])('throws UNABLE_TO_SERIALIZE_JSON for %s', (_, value) => {
    expectToThrowCode(() => measureJsonBytes(value, 1024), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });

  test('throws UNABLE_TO_SERIALIZE_JSON for a cycle', () => {
    const value: unknown[] = [];
    value.push(value);

    expectToThrowCode(() => measureJsonBytes(value, 1024), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });

  test('descends 64 levels, and throws UNABLE_TO_SERIALIZE_JSON below them', () => {
    const nest = (depth: number): unknown => (depth === 0 ? 1 : [nest(depth - 1)]);

    expect(measureJsonBytes(nest(64), 1024)).toBe(JSON.stringify(nest(64)).length);
    expectToThrowCode(() => measureJsonBytes(nest(65), 1024), ERRORS.UNABLE_TO_SERIALIZE_JSON);
  });

  test("wraps an error from the value's own code, keeping it as the cause", () => {
    const failure = new Error('getter failed');
    const value = {
      get broken(): never {
        throw failure;
      },
    };
    let thrown: unknown;
    try {
      measureJsonBytes(value, 1024);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ code: ERRORS.UNABLE_TO_SERIALIZE_JSON, cause: failure });
  });

  test.each([[-1], [1.5], [NaN], [Number.MAX_SAFE_INTEGER + 1]])(
    'measureJsonBytes(value, %d) -> throws INVALID_BYTE_LIMIT',
    (maxBytes) => {
      expectToThrowCode(() => measureJsonBytes({}, maxBytes), ERRORS.INVALID_BYTE_LIMIT);
    },
  );
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
