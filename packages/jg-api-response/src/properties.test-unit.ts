import fc from 'fast-check';
import { Exception, type IJSONValue } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { buildResponse, isResponse } from './response.js';

/*
 * Properties: every envelope buildResponse builds survives JSON and is recognised on arrival.
 */

// any error a service can respond with: an Exception with any data, or anything else thrown
const error = fc.oneof(
  fc
    .tuple(fc.string({ minLength: 1 }), fc.string(), fc.anything({ withBigInt: true }))
    .map(([code, message, data]) => new Exception(message, { code, data: data as IJSONValue })),
  fc.anything({ withBigInt: true, withNullPrototype: true, withDate: true }),
);

describe('buildResponse', () => {
  test('builds envelopes that pass isResponse after a trip through JSON', () => {
    fc.assert(
      fc.property(
        fc.option(fc.jsonValue(), { nil: undefined }),
        fc.option(error, { nil: undefined }),
        (data, failure) => {
          const response = buildResponse(data, failure);
          const parsed: unknown = JSON.parse(JSON.stringify(response));

          expect(isResponse(parsed)).toBe(true);
          expect(response.success).toBe(failure === undefined);
        },
      ),
    );
  });
});
