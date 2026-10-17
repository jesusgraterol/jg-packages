import { DEFAULT_MESSAGE } from 'jg-exception';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { buildResponse, isResponse } from './response.js';
import type { IAPIResponse, IParsedAPIResponse } from './types.js';

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('buildResponse', () => {
  test('can build an empty response', () => {
    expect(buildResponse()).toStrictEqual({ success: true, data: undefined, error: undefined });
  });

  test('can include any primitives in the data', () => {
    expect(buildResponse(true)).toStrictEqual({ success: true, data: true, error: undefined });
    expect(buildResponse(100)).toStrictEqual({ success: true, data: 100, error: undefined });
    expect(buildResponse('Hello!')).toStrictEqual({
      success: true,
      data: 'Hello!',
      error: undefined,
    });
    expect(buildResponse({ id: 1, name: 'John Doe' })).toStrictEqual({
      success: true,
      data: { id: 1, name: 'John Doe' },
      error: undefined,
    });
    expect(
      buildResponse([
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Doe' },
      ]),
    ).toStrictEqual({
      success: true,
      data: [
        { id: 1, name: 'John Doe' },
        { id: 2, name: 'Jane Doe' },
      ],
      error: undefined,
    });
  });

  test('can handle errors of any type', () => {
    expect(buildResponse(undefined, 'Ops, there was an error')).toStrictEqual({
      success: false,
      data: undefined,
      error: 'Ops, there was an error',
    });
    expect(buildResponse(undefined, new Error('Ops, there was an error'))).toStrictEqual({
      success: false,
      data: undefined,
      error: 'Ops, there was an error',
    });
  });

  test('turns any error that is passed, even a falsy one, into a message', () => {
    expect(buildResponse(undefined, null)).toStrictEqual({
      success: false,
      data: undefined,
      error: DEFAULT_MESSAGE,
    });
    expect(buildResponse(undefined, '')).toStrictEqual({
      success: false,
      data: undefined,
      error: DEFAULT_MESSAGE,
    });
    expect(buildResponse(undefined, 0)).toStrictEqual({
      success: false,
      data: undefined,
      error: DEFAULT_MESSAGE,
    });
  });

  test('can include data in an unsuccessful response', () => {
    expect(
      buildResponse({ some: 'data', foo: 123456 }, new Error('Ops, there was an error')),
    ).toStrictEqual({
      success: false,
      data: { some: 'data', foo: 123456 },
      error: 'Ops, there was an error',
    });
  });
});

describe('isResponse', () => {
  test('can identify a successful response object', () => {
    expect(isResponse(buildResponse())).toBe(true);
  });

  test('can identify a successful response object w/ data', () => {
    expect(isResponse(buildResponse({ hello: 'world' }))).toBe(true);
  });

  test('can identify an unsuccessful response object', () => {
    expect(isResponse(buildResponse(undefined, new Error("Oops, there's been an error.")))).toBe(
      true,
    );
  });

  test('can identify an unsuccessful response object w/ data', () => {
    expect(
      isResponse(buildResponse({ hello: 'world' }, new Error("Oops, there's been an error."))),
    ).toBe(true);
  });

  test('can identify an invalid response object', () => {
    expect(isResponse(undefined)).toBe(false);
    expect(isResponse(null)).toBe(false);
    expect(isResponse([])).toBe(false);
    expect(isResponse({})).toBe(false);
    expect(isResponse(123)).toBe(false);
    expect(isResponse('asd')).toBe(false);
    expect(isResponse(new Date())).toBe(false);
  });

  test('accepts envelopes whose undefined fields JSON dropped', () => {
    expect(isResponse({ success: true })).toBe(true);
    expect(isResponse({ success: true, data: undefined })).toBe(true);
    expect(isResponse({ success: false, error: 'Some error' })).toBe(true);
  });

  test('accepts the error: null that some services send on success', () => {
    expect(isResponse({ success: true, data: { id: 1 }, error: null })).toBe(true);
  });

  test('rejects values without a boolean success or with a non-string error', () => {
    expect(isResponse({ data: 123 })).toBe(false);
    expect(isResponse({ data: undefined, error: undefined })).toBe(false);
    expect(isResponse({ data: 'some data!', error: 'Some error' })).toBe(false);
    expect(isResponse({ error: 'Some error' })).toBe(false);
    expect(isResponse({ success: 'true', data: 1 })).toBe(false);
    expect(isResponse({ success: 1 })).toBe(false);
    expect(isResponse({ success: false, error: 404 })).toBe(false);
    expect(isResponse({ success: false, error: { message: 'Not found' } })).toBe(false);
    expect(isResponse([{ success: true }])).toBe(false);
  });
});

describe('JSON round trips', () => {
  test.each([
    [buildResponse({ id: 1, tags: ['a'] })],
    [buildResponse()],
    [buildResponse(undefined, new Error('Not found'))],
    [buildResponse({ partial: true }, 'Partly failed')],
  ])('isResponse(JSON.parse(JSON.stringify(%o))) -> true', (response) => {
    const parsed: unknown = JSON.parse(JSON.stringify(response));

    expect(isResponse(parsed)).toBe(true);
    expect(parsed).toMatchObject({ success: response.success });
    if (response.data !== undefined) {
      expect(parsed).toMatchObject({ data: response.data });
    }
    if (response.error !== undefined) {
      expect(parsed).toMatchObject({ error: response.error });
    }
  });
});

describe('types', () => {
  test('isResponse narrows to the parsed envelope of the given data type', () => {
    const value: unknown = JSON.parse('{"success":true,"data":{"id":1},"error":null}');

    if (!isResponse<{ id: number }>(value)) {
      throw new Error('expected an envelope');
    }
    expectTypeOf(value).toEqualTypeOf<IParsedAPIResponse<{ id: number }>>();
    expectTypeOf(value.data).toEqualTypeOf<{ id: number } | undefined>();
    expectTypeOf(value.error).toEqualTypeOf<string | null | undefined>();
  });

  test('buildResponse keeps the data type', () => {
    expectTypeOf(buildResponse({ id: 1 })).toEqualTypeOf<IAPIResponse<{ id: number }>>();
    expectTypeOf(buildResponse()).toEqualTypeOf<IAPIResponse<undefined>>();
  });
});
