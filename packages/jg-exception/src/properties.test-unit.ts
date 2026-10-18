import fc from 'fast-check';
import { inspect } from 'node:util';
import { describe, expect, test } from 'vitest';

import { extractMessage } from './error-handler/index.js';
import { Exception } from './exception/index.js';
import type { IJsonValue } from './shared/types.js';

/*
 * Properties: the guarantees error handling rests on, over anything a catch block can receive.
 */

// anything JavaScript can throw, including errors whose causes form chains or cycles
const thrown = fc.oneof(
  fc.anything({
    withBigInt: true,
    withBoxedValues: true,
    withDate: true,
    withMap: true,
    withNullPrototype: true,
    withObjectString: true,
    withSet: true,
    withSparseArray: true,
    withTypedArray: true,
  }),
  fc
    .tuple(fc.array(fc.string(), { minLength: 1, maxLength: 4 }), fc.boolean())
    .map(([messages, isCycle]) => {
      const errors = messages.map((message) => new Error(message));
      errors.forEach((error, index) => {
        error.cause = errors[index + 1] ?? (isCycle ? errors[0] : undefined);
      });
      return errors[0];
    }),
);

describe('extractMessage', () => {
  test('never throws, and always returns a non-empty message', () => {
    fc.assert(
      fc.property(thrown, (error) => {
        const message = extractMessage(error);

        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(0);
      }),
    );
  });
});

describe('Exception#toJSON', () => {
  test('survives a trip through JSON, whatever the data', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string(),
        fc.oneof(fc.jsonValue(), thrown),
        (code, message, data) => {
          const exception = new Exception(message, { code, data: data as IJsonValue });

          expect(JSON.parse(JSON.stringify(exception))).toStrictEqual(exception.toJSON());
        },
      ),
    );
  });
});

describe('Exception with redact', () => {
  // a value behind a fixed prefix, so it can't occur in the output's own text, such as `Exception`,
  // a property name, or a file path
  const secret = fc.stringMatching(/^[a-z0-9]{8,16}$/).map((token) => `SECRET-${token}`);

  // one layer of a cause chain, and where it holds the value
  const layer = fc.record({
    kind: fc.constantFrom('error', 'exception', 'object', 'string'),
    inMessage: fc.boolean(),
    inField: fc.boolean(),
  });

  test('never shows a value, wherever the message, the data, or a cause chain holds it', () => {
    fc.assert(
      fc.property(
        secret,
        fc.string(),
        fc.string(),
        fc.jsonValue(),
        fc.array(layer, { maxLength: 4 }),
        (value, before, after, json, layers) => {
          const text = (holdsValue: boolean): string =>
            holdsValue ? `${before}${value}${after}` : `${before}${after}`;
          const cause = layers.reduceRight<unknown>((inner, { kind, inMessage, inField }) => {
            switch (kind) {
              case 'error':
                return Object.assign(new Error(text(inMessage), { cause: inner }), {
                  detail: text(inField),
                });
              case 'exception':
                return new Exception(text(inMessage), {
                  code: 'INNER',
                  data: { detail: text(inField), json },
                  cause: inner,
                });
              case 'object':
                return { message: text(inMessage), detail: text(inField), cause: inner };
              default:
                return text(true);
            }
          }, undefined);
          const exception = new Exception(text(true), {
            code: 'FAILED',
            data: { json, detail: text(true), list: [text(true)] },
            cause,
            redact: [value],
          });
          const printed = inspect(exception, {
            depth: null,
            showHidden: true,
            maxArrayLength: null,
            maxStringLength: null,
          });

          expect(printed).not.toContain(value);
          expect(extractMessage(exception)).not.toContain(value);
          expect(JSON.stringify(exception)).not.toContain(value);
          expect(exception.toString()).not.toContain(value);
        },
      ),
    );
  });
});
