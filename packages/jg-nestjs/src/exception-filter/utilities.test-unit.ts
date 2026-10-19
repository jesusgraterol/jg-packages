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
  resolveErrorStatus,
  resolveFilterOptions,
  shouldLogError,
  shouldReportError,
} from './utilities.js';

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
    expect(resolveErrorStatus(new Error('A library failed.'), resolveTeapot)).toBe(418);
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
