import fc from 'fast-check';
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
