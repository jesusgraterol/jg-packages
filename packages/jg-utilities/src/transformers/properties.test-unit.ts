import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

import { decodeBase64Url, encodeBase64Url } from './base64url.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { parseJson, stringifyJson, stringifyJsonDeterministically } from './json.js';

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
