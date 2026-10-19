// @vitest-environment node
import fc from 'fast-check';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { ERRORS } from '../shared/errors.js';
import type { ISchema } from '../shared/types.js';
import { encodeBase64Url, encodeCursor } from '../transformers/index.js';

import { createCursorCodec } from './cursor-codec.js';

// a payment list's continuation: its filters and the last row's sort keys
type IPaymentCursor = {
  status: string | null;
  customerId?: string | null;
  createdAt: string;
  id: number;
};

// a hand-written schema, so the codec's contract doesn't depend on a validation library
const PAYMENT_CURSOR_SCHEMA: ISchema<IPaymentCursor> = {
  parse: (value) => {
    const candidate = value as Partial<IPaymentCursor> | null;
    if (
      typeof candidate !== 'object' ||
      candidate === null ||
      typeof candidate.createdAt !== 'string' ||
      typeof candidate.id !== 'number'
    ) {
      throw new TypeError('Not a payment cursor.');
    }
    return candidate as IPaymentCursor;
  },
};

const PAYMENT_CURSOR: IPaymentCursor = {
  status: 'paid',
  customerId: null,
  createdAt: '2026-10-19T00:00:00.000Z',
  id: 42,
};

// the list's filters, which a cursor must match
type IPaymentScope = { status?: string | null | undefined; customerId?: string | null | undefined };

const codec = createCursorCodec<IPaymentCursor, IPaymentScope>({
  schema: PAYMENT_CURSOR_SCHEMA,
});

// the error decode threw, for asserting its code, data, and cause together
const catchError = (operation: () => unknown): unknown => {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('Expected the operation to throw.');
};

describe('createCursorCodec', () => {
  test('decodes the cursor it encoded, for the same scope', () => {
    const cursor = codec.encode(PAYMENT_CURSOR);

    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(codec.decode(cursor, { status: 'paid', customerId: null })).toStrictEqual(
      PAYMENT_CURSOR,
    );
  });

  test.each([null, undefined])('decodes %o as the first page', (cursor) => {
    expect(codec.decode(cursor, { status: 'paid' })).toBeUndefined();
  });

  test('counts null and undefined as the same scope value', () => {
    const cursor = codec.encode({ ...PAYMENT_CURSOR, status: null });

    expect(codec.decode(cursor, { status: undefined, customerId: undefined })).toStrictEqual({
      ...PAYMENT_CURSOR,
      status: null,
    });
  });

  test.each([
    [{ status: 'refunded', customerId: null }],
    [{ status: 'paid', customerId: 'cus_1' }],
  ])('refuses a cursor from another scope, %o', (scope) => {
    const error = catchError(() => codec.decode(codec.encode(PAYMENT_CURSOR), scope));

    expect(error).toMatchObject({
      code: ERRORS.INVALID_CURSOR,
      message: 'The cursor is not valid for this list.',
      data: { reason: 'scope' },
    });
    expect(error).not.toHaveProperty('cause');
  });

  test('compares object scope values deeply, ignoring key order', () => {
    const tagCodec = createCursorCodec<
      { filter: { tags: string[]; owner: string }; id: number },
      { filter: { owner: string; tags: string[] } }
    >({
      schema: {
        parse: (value) => value as { filter: { tags: string[]; owner: string }; id: number },
      },
    });
    const cursor = tagCodec.encode({ filter: { tags: ['a', 'b'], owner: 'ada' }, id: 1 });

    expect(tagCodec.decode(cursor, { filter: { owner: 'ada', tags: ['a', 'b'] } })).toStrictEqual({
      filter: { tags: ['a', 'b'], owner: 'ada' },
      id: 1,
    });
    expectToThrowCode(
      () => tagCodec.decode(cursor, { filter: { owner: 'ada', tags: ['b', 'a'] } }),
      ERRORS.INVALID_CURSOR,
    );
  });

  test('uses matchesScope instead of the default check when it is given', () => {
    const adminCodec = createCursorCodec<IPaymentCursor, { isAdmin: boolean; status: string }>({
      schema: PAYMENT_CURSOR_SCHEMA,
      matchesScope: (payload, scope) => scope.isAdmin || payload.status === scope.status,
    });
    const cursor = adminCodec.encode(PAYMENT_CURSOR);

    expect(adminCodec.decode(cursor, { isAdmin: true, status: 'refunded' })).toStrictEqual(
      PAYMENT_CURSOR,
    );
    expectToThrowCode(
      () => adminCodec.decode(cursor, { isAdmin: false, status: 'refunded' }),
      ERRORS.INVALID_CURSOR,
    );
  });

  test.each([
    ['an empty string', ''],
    ['characters outside base64url', 'abc+/='],
    ['base64url that is not JSON', encodeBase64Url('not json')],
    ['JSON that is not an object or array', encodeBase64Url('42')],
    ['a cursor past the maximum length', 'a'.repeat(2049)],
  ])('refuses %s as a format error, with the cause', (_, cursor) => {
    const error = catchError(() => codec.decode(cursor, {}));

    expect(error).toMatchObject({ code: ERRORS.INVALID_CURSOR, data: { reason: 'format' } });
    expect(error).toHaveProperty('cause.code', ERRORS.INVALID_CURSOR);
  });

  test("refuses a payload that fails the schema, with the schema's error as the cause", () => {
    const error = catchError(() => codec.decode(encodeCursor({ id: 'not a number' }), {}));

    expect(error).toMatchObject({ code: ERRORS.INVALID_CURSOR, data: { reason: 'schema' } });
    expect(error).toHaveProperty('cause.message', 'Not a payment cursor.');
  });

  test("lets the schema's error through when encode gets a payload that fails it", () => {
    expect(() => codec.encode({ id: 1 } as IPaymentCursor)).toThrow('Not a payment cursor.');
  });

  test('refuses to encode a cursor past the maximum length', () => {
    const shortCodec = createCursorCodec<IPaymentCursor>({
      schema: PAYMENT_CURSOR_SCHEMA,
      maxLength: 16,
    });

    expectToThrowCode(
      () => shortCodec.encode(PAYMENT_CURSOR),
      ERRORS.CURSOR_TOO_LONG,
      "The cursor is longer than the codec's maximum length.",
    );
  });

  test('encodes text outside Latin-1, unlike btoa', () => {
    const textCodec = createCursorCodec<{ query: string; id: number }>({
      schema: { parse: (value) => value as { query: string; id: number } },
    });
    const payload = { query: 'café ☕ 日本', id: 7 };

    expect(textCodec.decode(textCodec.encode(payload), { query: 'café ☕ 日本' })).toStrictEqual(
      payload,
    );
  });

  test('types decode by the schema, and the default scope by the payload', () => {
    expectTypeOf(codec.decode).returns.toEqualTypeOf<IPaymentCursor | undefined>();
    expectTypeOf(createCursorCodec<IPaymentCursor>({ schema: PAYMENT_CURSOR_SCHEMA }).decode)
      .parameter(1)
      .toEqualTypeOf<Partial<IPaymentCursor>>();
  });

  test('decodes every cursor it encodes, for the payload as its own scope', () => {
    const jsonCodec = createCursorCodec<{ [key: string]: string | number | null }>({
      schema: { parse: (value) => value as { [key: string]: string | number | null } },
    });
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 8 }),
          fc.oneof(fc.string({ maxLength: 16 }), fc.integer(), fc.constant(null)),
          { maxKeys: 6 },
        ),
        (dictionary) => {
          // fast-check builds dictionaries without a prototype, and decoded JSON has one
          const payload = Object.fromEntries(Object.entries(dictionary));

          expect(jsonCodec.decode(jsonCodec.encode(payload), payload)).toStrictEqual(payload);
        },
      ),
    );
  });

  describe('with a Zod schema', () => {
    const PaginationCursorSchema = z.strictObject({
      status: z.enum(['paid', 'refunded']).nullable(),
      createdAt: z.iso.datetime(),
      id: z.int().positive(),
    });
    const zodCodec = createCursorCodec({ schema: PaginationCursorSchema });

    test('round-trips a valid cursor', () => {
      const payload = { status: 'paid' as const, createdAt: '2026-10-19T00:00:00Z', id: 3 };

      expect(zodCodec.decode(zodCodec.encode(payload), { status: 'paid' })).toStrictEqual(payload);
    });

    test('refuses a cursor that fails it, with the ZodError as the cause', () => {
      const error = catchError(() =>
        zodCodec.decode(encodeCursor({ status: 'paid', createdAt: 'yesterday', id: 3 }), {}),
      );

      expect(error).toMatchObject({ code: ERRORS.INVALID_CURSOR, data: { reason: 'schema' } });
      expect(error).toHaveProperty('cause.name', 'ZodError');
    });
  });
});
