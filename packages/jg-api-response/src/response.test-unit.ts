import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_MESSAGE, Exception, type IJsonValue, UNKNOWN_ERROR_CODE } from 'jg-exception';
import { describe, expect, expectTypeOf, test } from 'vitest';

import { buildResponse, isResponse } from './response.js';
import type { IApiError, IApiResponse, IParsedApiError, IParsedApiResponse } from './types.js';

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */

describe('buildResponse', () => {
  test('can build an empty response', () => {
    expect(buildResponse()).toStrictEqual({ success: true, data: undefined, error: null });
  });

  test('can include any data', () => {
    expect(buildResponse(true)).toStrictEqual({ success: true, data: true, error: null });
    expect(buildResponse(100)).toStrictEqual({ success: true, data: 100, error: null });
    expect(buildResponse('Hello!')).toStrictEqual({ success: true, data: 'Hello!', error: null });
    expect(buildResponse([{ id: 1 }, { id: 2 }])).toStrictEqual({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      error: null,
    });
  });

  test('keeps the code, message, and data of an Exception', () => {
    const exception = new Exception('The user was not found.', {
      code: 'USER_NOT_FOUND',
      data: { id: 1 },
      cause: new Error('no row'),
    });

    expect(buildResponse(undefined, exception)).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: 'USER_NOT_FOUND', message: 'The user was not found.', data: { id: 1 } },
    });
  });

  test('gives an Exception without data null data', () => {
    expect(
      buildResponse(undefined, new Exception('Not found', { code: 'NOT_FOUND' })).error,
    ).toStrictEqual({ code: 'NOT_FOUND', message: 'Not found', data: null });
  });

  test('uses null for Exception data that cannot be serialized, so the envelope always can be', () => {
    const data: Record<string, unknown> = { id: 1 };
    data['self'] = data;
    const response = buildResponse(
      undefined,
      new Exception('Failed', { code: 'FAILED', data: data as unknown as IJsonValue }),
    );

    expect(response.error).toStrictEqual({ code: 'FAILED', message: 'Failed', data: null });
    expect(() => JSON.stringify(response)).not.toThrow();
  });

  test('keeps the string code of any other error', () => {
    let systemError: unknown;
    try {
      readFileSync(join(tmpdir(), 'jg-api-response-missing-file'));
    } catch (error) {
      systemError = error;
    }

    expect(buildResponse(undefined, systemError).error).toMatchObject({
      code: 'ENOENT',
      data: null,
    });
    expect(buildResponse(undefined, { code: 'RATE_LIMITED', message: 'Slow down' })).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: 'RATE_LIMITED', message: 'Slow down', data: null },
    });
  });

  test('gives any other error the unknown code and its message, without its data', () => {
    expect(buildResponse(undefined, 'Oops, there was an error').error).toStrictEqual({
      code: UNKNOWN_ERROR_CODE,
      message: 'Oops, there was an error',
      data: null,
    });
    expect(
      buildResponse(undefined, new Error('Request failed', { cause: new Error('Timed out') }))
        .error,
    ).toStrictEqual({
      code: UNKNOWN_ERROR_CODE,
      message: 'Request failed; [CAUSE]: Timed out',
      data: null,
    });
    expect(buildResponse(undefined, { message: 'Bad', code: 404, data: 1n }).error).toStrictEqual({
      code: UNKNOWN_ERROR_CODE,
      message: 'Bad',
      data: null,
    });
  });

  test.each([
    ['null', null],
    ['an empty string', ''],
    ['zero', 0],
  ])('fails with the default message for %s', (_, error) => {
    expect(buildResponse(undefined, error)).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: UNKNOWN_ERROR_CODE, message: DEFAULT_MESSAGE, data: null },
    });
  });

  test('can include data in an unsuccessful response', () => {
    expect(buildResponse({ partial: true }, new Error('Partly failed'))).toStrictEqual({
      success: false,
      data: { partial: true },
      error: { code: UNKNOWN_ERROR_CODE, message: 'Partly failed', data: null },
    });
  });
});

describe('isResponse', () => {
  test.each([
    ['a successful response', buildResponse()],
    ['a successful response with data', buildResponse({ hello: 'world' })],
    ['a failed response', buildResponse(undefined, new Error('Failed'))],
    ['a failed response with data', buildResponse({ hello: 'world' }, new Error('Failed'))],
  ])('identifies %s', (_, response) => {
    expect(isResponse(response)).toBe(true);
  });

  test('accepts envelopes whose undefined fields JSON dropped, or that leave out error', () => {
    expect(isResponse({ success: true })).toBe(true);
    expect(isResponse({ success: true, data: undefined })).toBe(true);
    expect(isResponse({ success: true, data: { id: 1 }, error: null })).toBe(true);
  });

  test('accepts an envelope error without data, from another service', () => {
    const value: unknown = { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } };

    expect(isResponse(value)).toBe(true);
  });

  test('accepts an envelope error with any data, which it leaves unchecked', () => {
    expect(isResponse({ success: false, error: { code: 'X', message: 'Failed', data: 1n } })).toBe(
      true,
    );
    expect(
      isResponse({ success: false, error: { code: 'X', message: 'Failed', extra: true } }),
    ).toBe(true);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', []],
    ['an empty object', {}],
    ['a number', 123],
    ['a string', 'asd'],
    ['a date', new Date()],
    ['no success', { data: 123 }],
    ['a string success', { success: 'true', data: 1 }],
    ['a numeric success', { success: 1 }],
    ['a string error', { success: false, error: 'Some error' }],
    ['a numeric error', { success: false, error: 404 }],
    ['an error without a code', { success: false, error: { message: 'Not found' } }],
    ['an error without a message', { success: false, error: { code: 'NOT_FOUND' } }],
    ['a numeric code', { success: false, error: { code: 404, message: 'Not found' } }],
    ['an array error', { success: false, error: ['NOT_FOUND', 'Not found'] }],
    ['an envelope in an array', [{ success: true }]],
  ])('rejects %s', (_, value) => {
    expect(isResponse(value)).toBe(false);
  });
});

describe('JSON round trips', () => {
  test.each([
    ['data', buildResponse({ id: 1, tags: ['a'] })],
    ['no data', buildResponse()],
    [
      'an Exception',
      buildResponse(undefined, new Exception('Not found', { code: 'NOT_FOUND', data: { id: 1 } })),
    ],
    ['another error', buildResponse({ partial: true }, 'Partly failed')],
  ])('an envelope with %s passes isResponse after JSON', (_, response) => {
    const parsed: unknown = JSON.parse(JSON.stringify(response));

    expect(isResponse(parsed)).toBe(true);
    expect(parsed).toStrictEqual(
      response.data === undefined ? { success: response.success, error: response.error } : response,
    );
  });
});

describe('types', () => {
  test('isResponse narrows to the parsed envelope of the given data type', () => {
    const value: unknown = JSON.parse('{"success":true,"data":{"id":1},"error":null}');

    if (!isResponse<{ id: number }>(value)) {
      throw new Error('expected an envelope');
    }
    expectTypeOf(value).toEqualTypeOf<IParsedApiResponse<{ id: number }>>();
    expectTypeOf(value.data).toEqualTypeOf<{ id: number } | undefined>();
    expectTypeOf(value.error).toEqualTypeOf<IParsedApiError | null | undefined>();
    if (value.error) {
      expectTypeOf(value.error.code).toEqualTypeOf<string>();
      expectTypeOf(value.error.data).toEqualTypeOf<unknown>();
    }
  });

  test('buildResponse keeps the data type, and its error data is JSON', () => {
    expectTypeOf(buildResponse({ id: 1 })).toEqualTypeOf<IApiResponse<{ id: number }>>();
    expectTypeOf(buildResponse()).toEqualTypeOf<IApiResponse<undefined>>();
    expectTypeOf(buildResponse().error).toEqualTypeOf<IApiError | null>();
    expectTypeOf<IApiError['data']>().toEqualTypeOf<IJsonValue>();
  });
});
