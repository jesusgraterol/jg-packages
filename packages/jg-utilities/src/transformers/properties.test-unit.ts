import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { decodeBase64Url, encodeBase64Url } from './base64url.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import {
  measureJsonBytes,
  parseJson,
  stringifyJson,
  stringifyJsonDeterministically,
} from './json.js';
import { compareCodePoints, countUtf8Bytes, truncateToUtf8Bytes } from './string.js';

/*
 * Properties: the transformers' guarantees, over generated inputs, for what examples can't cover.
 */

// a JSON object or array, which the JSON helpers and cursors accept
const jsonContainer = fc.oneof(
  fc.dictionary(fc.string(), fc.jsonValue({ maxDepth: 3 })),
  fc.array(fc.jsonValue({ maxDepth: 3 })),
);

describe('base64url', () => {
  test('decodes every string it encodes, and encodes with URL-safe characters only', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (text) => {
        const encoded = encodeBase64Url(text);

        expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
        expect(decodeBase64Url(encoded)).toBe(text);
      }),
    );
  });
});

describe('cursors', () => {
  test('decode to the JSON value they encode', () => {
    fc.assert(
      fc.property(jsonContainer, (value) => {
        const cursor = encodeCursor(value);
        // decodeCursor refuses cursors longer than its limit
        fc.pre(cursor.length <= 2048);

        expect(stringifyJson(decodeCursor(cursor))).toBe(stringifyJson(value));
      }),
    );
  });
});

describe('JSON helpers', () => {
  test('parseJson reads back what stringifyJson writes, as JSON.parse would', () => {
    fc.assert(
      fc.property(jsonContainer, (value) => {
        const text = stringifyJson(value);

        expect(parseJson(text)).toStrictEqual(JSON.parse(text));
        expect(stringifyJson(parseJson<object>(text))).toBe(text);
      }),
    );
  });

  test('stringifyJsonDeterministically writes the same text whatever the key order', () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue({ maxDepth: 3 }), { minKeys: 1 }),
        (value) => {
          const reversed = Object.fromEntries(Object.entries(value).reverse());

          expect(stringifyJsonDeterministically(reversed)).toBe(
            stringifyJsonDeterministically(value),
          );
          expect(JSON.parse(stringifyJsonDeterministically(value))).toStrictEqual(
            JSON.parse(JSON.stringify(value)),
          );
        },
      ),
    );
  });
});

describe('truncateToUtf8Bytes', () => {
  // a string of any code points, lone surrogates included
  const text = fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: 'grapheme' }));

  test('gives the longest prefix of whole code points that fits the limit', () => {
    fc.assert(
      fc.property(text, fc.nat({ max: 64 }), (value, maxBytes) => {
        const result = truncateToUtf8Bytes(value, maxBytes);
        const encoder = new TextEncoder();

        expect(value.startsWith(result)).toBe(true);
        expect(encoder.encode(result).length).toBeLessThanOrEqual(maxBytes);
        if (result !== value) {
          const nextCodePoint = String.fromCodePoint(value.codePointAt(result.length) ?? 0);
          const next = value.slice(result.length, result.length + nextCodePoint.length);

          expect(encoder.encode(result + next).length).toBeGreaterThan(maxBytes);
        }
      }),
    );
  });
});

describe('deterministic JSON', () => {
  test('strict mode writes what default mode writes for plain JSON data', () => {
    fc.assert(
      fc.property(jsonContainer, (value) => {
        expect(stringifyJsonDeterministically(value, { strict: true })).toBe(
          stringifyJsonDeterministically(value),
        );
      }),
    );
  });

  test('default mode holds what JSON.stringify holds, for values it leaves out or converts', () => {
    const loose = fc.letrec((tie) => ({
      value: fc.oneof(
        { depthSize: 'small' },
        fc.jsonValue({ maxDepth: 1 }),
        fc.constantFrom(undefined, NaN, Infinity, -0, () => 1),
        fc.date({ noInvalidDate: true }),
        fc.array(tie('value')),
        fc.dictionary(fc.string(), tie('value')),
      ),
    })).value;

    fc.assert(
      fc.property(fc.dictionary(fc.string(), loose), (value) => {
        expect(JSON.parse(stringifyJsonDeterministically(value))).toStrictEqual(
          JSON.parse(JSON.stringify(value)),
        );
      }),
    );
  });
});

describe('byte counts', () => {
  // a string of any code points, lone surrogates included
  const anyText = fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: 'grapheme' }));
  const encoder = new TextEncoder();

  test('countUtf8Bytes counts what TextEncoder writes', () => {
    fc.assert(
      fc.property(anyText, (text) => {
        expect(countUtf8Bytes(text)).toBe(encoder.encode(text).length);
      }),
    );
  });

  test('countUtf8Bytes is exact up to its limit, and above it past the limit', () => {
    fc.assert(
      fc.property(anyText, fc.nat(64), (text, maxBytes) => {
        const exact = encoder.encode(text).length;
        const counted = countUtf8Bytes(text, maxBytes);

        expect(exact <= maxBytes ? counted === exact : counted > maxBytes).toBe(true);
      }),
    );
  });

  test('measureJsonBytes measures what JSON.stringify writes, in UTF-8', () => {
    const value = fc.oneof(
      fc.jsonValue({ maxDepth: 3, stringUnit: 'binary' }),
      fc.dictionary(fc.string({ unit: 'binary' }), fc.jsonValue({ maxDepth: 2 })),
    );

    fc.assert(
      fc.property(value, (input) => {
        const exact = encoder.encode(JSON.stringify(input)).length;

        expect(measureJsonBytes(input, 1_000_000)).toBe(exact);
      }),
    );
  });
});

describe('compareCodePoints', () => {
  // the order of the strings' code points, as an array of numbers
  const compareByArrays = (left: string, right: string): number => {
    const leftCodePoints = [...left].map((character) => character.codePointAt(0) ?? 0);
    const rightCodePoints = [...right].map((character) => character.codePointAt(0) ?? 0);
    for (let index = 0; index < Math.min(leftCodePoints.length, rightCodePoints.length); index++) {
      const difference = (leftCodePoints[index] ?? 0) - (rightCodePoints[index] ?? 0);
      if (difference !== 0) {
        return Math.sign(difference);
      }
    }
    return Math.sign(leftCodePoints.length - rightCodePoints.length);
  };
  const anyText = fc.oneof(fc.string({ unit: 'binary' }), fc.string({ unit: 'grapheme' }));

  test('orders strings as their code points compare', () => {
    fc.assert(
      fc.property(anyText, anyText, (left, right) => {
        expect(compareCodePoints(left, right)).toBe(compareByArrays(left, right));
      }),
    );
  });

  test('orders a string after itself with any suffix', () => {
    fc.assert(
      fc.property(anyText, anyText, (prefix, suffix) => {
        fc.pre(suffix.length > 0);

        expect(compareCodePoints(prefix + suffix, prefix)).toBe(1);
        expect(compareCodePoints(prefix, prefix)).toBe(0);
      }),
    );
  });
});
