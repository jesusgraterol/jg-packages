import { Exception, isException } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { ApiException } from './api-exception.js';

describe('ApiException', () => {
  test('is an Exception with its status, and the options an Exception takes', () => {
    const cause = new Error('The row was locked.');
    const exception = new ApiException('The project was not found.', {
      code: 'PROJECT_NOT_FOUND',
      status: 404,
      data: { id: 42 },
      severity: 'expected',
      shouldLog: true,
      cause,
    });

    expect(exception).toBeInstanceOf(Exception);
    expect(isException(exception)).toBe(true);
    expect(exception).toMatchObject({
      name: 'ApiException',
      code: 'PROJECT_NOT_FOUND',
      message: 'The project was not found.',
      status: 404,
      data: { id: 42 },
      severity: 'expected',
      shouldLog: true,
      cause,
    });
    expect(exception.toJSON()).toStrictEqual({
      name: 'ApiException',
      code: 'PROJECT_NOT_FOUND',
      message: 'The project was not found.',
      data: { id: 42 },
    });
  });

  test.each([
    [undefined, 500],
    [400, 400],
    [599, 599],
    [399, 500],
    [600, 500],
    [404.5, 500],
    [Number.NaN, 500],
  ])('new ApiException(message, { status: %s }).status -> %d', (status, expected) => {
    expect(new ApiException('Failed.', { code: 'FAILED', status }).status).toBe(expected);
  });

  test('takes a missing options object, as a caller without types might pass', () => {
    const exception = new ApiException(
      'Failed.',
      undefined as unknown as ConstructorParameters<typeof ApiException>[1],
    );

    expect(exception).toMatchObject({ code: 'UNKNOWN_ERROR', status: 500 });
  });

  test('keeps its name, code, status, and redacted data as the cause of a redacting Exception', () => {
    const cause = new ApiException('The upstream rejected tok_live_1.', {
      code: 'UPSTREAM_REJECTED',
      status: 502,
      data: { token: 'tok_live_1' },
    });
    const exception = new Exception('Failed.', { code: 'FAILED', cause, redact: ['tok_live_1'] });
    const snapshot = exception.cause as Exception & Record<string, unknown>;

    expect(snapshot.toJSON()).toStrictEqual({
      name: 'ApiException',
      code: 'UPSTREAM_REJECTED',
      message: 'The upstream rejected [redacted].',
      data: { token: '[redacted]' },
    });
    expect(snapshot['status']).toBe(502);
  });
});
