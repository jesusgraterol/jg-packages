import {
  BadRequestException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DEFAULT_MESSAGE, Exception } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import {
  buildErrorBody,
  extractHttpExceptionMessage,
  isExposedClientError,
  resolveErrorStatus,
  resolveFilterOptions,
  shouldLogError,
  shouldReportError,
} from './utilities.js';

/**
 * Builds an error the way http-errors builds one for Express's middleware, such as a body parser.
 * @param fields The fields to set on it.
 * @returns The error.
 */
const createClientError = (fields: Record<string, unknown>): Error =>
  Object.assign(new Error('request entity too large'), {
    statusCode: 413,
    status: 413,
    expose: true,
    ...fields,
  });

describe('isExposedClientError', () => {
  test.each<[string, unknown, boolean]>([
    ['a body over the limit', createClientError({}), true],
    ['the lowest client status', createClientError({ statusCode: 400 }), true],
    ['the highest client status', createClientError({ statusCode: 499 }), true],
    ['an unexposed client error', createClientError({ expose: false }), false],
    ['an error without expose', createClientError({ expose: undefined }), false],
    ['an exposed server error', createClientError({ statusCode: 503 }), false],
    ['a status below 400', createClientError({ statusCode: 399 }), false],
    ['a fractional status', createClientError({ statusCode: 413.5 }), false],
    ['a status written as a string', createClientError({ statusCode: '413' }), false],
    ['a message that is not a string', { statusCode: 413, expose: true, message: 413 }, false],
    ['null', null, false],
    ['a string', 'request entity too large', false],
  ])('%s -> %s', (_, error, expected) => {
    expect(isExposedClientError(error)).toBe(expected);
  });
});

describe('resolveFilterOptions', () => {
  test('fills in the defaults', () => {
    const options = resolveFilterOptions(undefined);

    expect(options).toMatchObject({
      report: undefined,
      resolveStatus: undefined,
      ignoredStatuses: [401, 429],
      ignoredCodes: [ERRORS.CORS_ORIGIN_NOT_ALLOWED],
    });
    expect(options.redactUrl('/a?token=1')).toBe('/a?token=1');
  });

  test('keeps what the app gave', () => {
    const redactUrl = (url: string): string => url.replace(/token=\w+/, 'token=[redacted]');
    const options = resolveFilterOptions({ ignoredStatuses: [], ignoredCodes: ['X'], redactUrl });

    expect(options).toMatchObject({ ignoredStatuses: [], ignoredCodes: ['X'] });
    expect(options.redactUrl('/a?token=1')).toBe('/a?token=[redacted]');
  });
});

describe('resolveErrorStatus', () => {
  const resolveTeapot = (): number => 418;

  test("prefers an ApiException's status, then an HttpException's, then the resolver's", () => {
    expect(
      resolveErrorStatus(new ApiException('A', { code: 'A', status: 409 }), resolveTeapot),
    ).toBe(409);
    expect(resolveErrorStatus(new NotFoundException(), resolveTeapot)).toBe(404);
    expect(resolveErrorStatus(createClientError({}), resolveTeapot)).toBe(413);
    expect(resolveErrorStatus(new Error('A library failed.'), resolveTeapot)).toBe(418);
  });

  test("leaves an unexposed or server error's statusCode to the resolver", () => {
    expect(resolveErrorStatus(createClientError({ expose: false }), undefined)).toBe(500);
    expect(resolveErrorStatus(createClientError({ statusCode: 503 }), undefined)).toBe(500);
  });

  test.each([[undefined], [302], [600], [418.5]])(
    'falls back to 500 when the resolver gives %s',
    (resolved) => {
      expect(resolveErrorStatus(new Error('Failed.'), () => resolved)).toBe(500);
    },
  );

  test('gives 500 without a resolver', () => {
    expect(resolveErrorStatus('a string', undefined)).toBe(500);
  });
});

describe('extractHttpExceptionMessage', () => {
  test.each<[string, string | Record<string, unknown>, string]>([
    ['a string response', 'Gone for good', 'Gone for good'],
    ['a message', { message: 'No such route', error: 'Not Found' }, 'No such route'],
    ['a msg', { msg: 'Slow down' }, 'Slow down'],
    ['an error', { message: ['name is required'], error: 'Bad Request' }, 'Bad Request'],
    ['an err', { err: 'Upstream down', message: 7 }, 'Upstream down'],
    ['none of them', { statusCode: 400 }, DEFAULT_MESSAGE],
  ])('reads %s', (_, response, expected) => {
    expect(extractHttpExceptionMessage(new HttpException(response, 400))).toBe(expected);
  });

  test('gives the default message for a response that is neither a string nor an object', () => {
    expect(extractHttpExceptionMessage(new HttpException(null as never, 400))).toBe(
      DEFAULT_MESSAGE,
    );
  });
});

describe('buildErrorBody', () => {
  test("sends an Exception's code, message, and data", () => {
    expect(
      buildErrorBody(
        new ApiException('Taken.', { code: 'NAME_TAKEN', status: 409, data: { n: 1 } }),
      ),
    ).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: 'NAME_TAKEN', message: 'Taken.', data: { n: 1 } },
    });
    expect(buildErrorBody(new Exception('Locked.', { code: 'LOCKED' }))).toMatchObject({
      error: { code: 'LOCKED', message: 'Locked.', data: null },
    });
  });

  test("sends HTTP_EXCEPTION with an HttpException's own message, without its status", () => {
    expect(buildErrorBody(new BadRequestException('The page is too large.'))).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: ERRORS.HTTP_EXCEPTION, message: 'The page is too large.', data: null },
    });
  });

  test("sends HTTP_EXCEPTION with an exposed client error's own message", () => {
    expect(buildErrorBody(createClientError({}))).toStrictEqual({
      success: false,
      data: undefined,
      error: { code: ERRORS.HTTP_EXCEPTION, message: 'request entity too large', data: null },
    });
  });

  test("never sends the message of a client error that isn't exposed", () => {
    expect(buildErrorBody(createClientError({ expose: false }))).toMatchObject({
      error: { code: ERRORS.INTERNAL_ERROR, message: ERROR_MESSAGES.INTERNAL_ERROR },
    });
  });

  test("never sends another error's message", () => {
    expect(
      buildErrorBody(new Error('password authentication failed for user "app"')),
    ).toStrictEqual({
      success: false,
      data: undefined,
      error: {
        code: ERRORS.INTERNAL_ERROR,
        message: ERROR_MESSAGES.INTERNAL_ERROR,
        data: null,
      },
    });
  });
});

describe('shouldLogError', () => {
  test.each<[string, unknown, boolean]>([
    [
      'an Exception the throw site asked to log',
      new Exception('A', { code: 'A', shouldLog: true }),
      true,
    ],
    ['a critical Exception', new ApiException('A', { code: 'A', severity: 'critical' }), true],
    ['an ordinary Exception', new ApiException('A', { code: 'A', status: 500 }), false],
    ['an HttpException', new ServiceUnavailableException(), false],
    ['an exposed client error', createClientError({}), false],
    ['an unexposed client error', createClientError({ expose: false }), true],
    ['an exposed server error', createClientError({ statusCode: 503 }), true],
    ['an unexpected error', new TypeError('x is undefined'), true],
    ['a thrown string', 'failed', true],
  ])('%s -> %s', (_, error, expected) => {
    expect(shouldLogError(error)).toBe(expected);
  });
});

describe('shouldReportError', () => {
  const options = resolveFilterOptions(undefined);

  test.each<[string, unknown, number, boolean]>([
    ['an unexpected error', new Error('Failed.'), 500, true],
    [
      'an expected Exception',
      new ApiException('A', { code: 'A', severity: 'expected' }),
      404,
      false,
    ],
    ['a critical Exception', new ApiException('A', { code: 'A', severity: 'critical' }), 500, true],
    ['an ignored status', new ApiException('A', { code: 'A', status: 401 }), 401, false],
    ['a rate-limited HttpException', new HttpException('Slow down', 429), 429, false],
    [
      'an ignored code',
      new ApiException('A', { code: ERRORS.CORS_ORIGIN_NOT_ALLOWED, status: 403 }),
      403,
      false,
    ],
    ['an HttpException without a code', new NotFoundException(), 404, true],
  ])('%s -> %s', (_, error, status, expected) => {
    expect(shouldReportError(error, status, options)).toBe(expected);
  });

  test("uses the app's ignored statuses and codes instead of the defaults", () => {
    const custom = resolveFilterOptions({ ignoredStatuses: [404], ignoredCodes: ['NAME_TAKEN'] });

    expect(shouldReportError(new NotFoundException(), 404, custom)).toBe(false);
    expect(shouldReportError(new HttpException('Unauthorized', 401), 401, custom)).toBe(true);
    expect(shouldReportError(new Exception('A', { code: 'NAME_TAKEN' }), 500, custom)).toBe(false);
  });
});
