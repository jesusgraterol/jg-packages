import { Controller, Get, Logger, NotFoundException } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Exception } from 'jg-exception';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { ApiExceptionFilter } from './api-exception.filter.js';
import { API_EXCEPTION_FILTER_OPTIONS } from './constants.js';
import type { IErrorReport } from './types.js';

@Controller('errors')
class ErrorsController {
  @Get('api-exception')
  public throwApiException(): never {
    throw new ApiException('The name is taken.', {
      code: 'NAME_TAKEN',
      status: 409,
      data: { name: 'acme' },
    });
  }

  @Get('unknown')
  public throwUnknown(): never {
    throw new Error('password authentication failed for user "app"');
  }

  @Get('should-log')
  public throwShouldLog(): never {
    throw new ApiException('The export was too large.', {
      code: 'EXPORT_TOO_LARGE',
      shouldLog: true,
    });
  }

  @Get('critical')
  public throwCritical(): never {
    throw new Exception('The ledger is out of balance.', {
      code: 'LEDGER_UNBALANCED',
      severity: 'critical',
    });
  }

  @Get('expected')
  public throwExpected(): never {
    throw new ApiException('The project was not found.', {
      code: 'PROJECT_NOT_FOUND',
      status: 404,
      severity: 'expected',
    });
  }

  @Get('http')
  public throwHttpException(): never {
    throw new NotFoundException('No such project');
  }
}

// what the reporter does, which a test can change
let reportImplementation: (report: IErrorReport) => void | Promise<void> = () => undefined;
const report = vi.fn((errorReport: IErrorReport) => reportImplementation(errorReport));
let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp({
    controllers: [ErrorsController],
    providers: [
      {
        provide: API_EXCEPTION_FILTER_OPTIONS,
        useValue: {
          report,
          redactUrl: (url: string) => url.replace(/token=\w+/, 'token=[redacted]'),
        },
      },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  });
});

afterEach(() => {
  report.mockClear();
  reportImplementation = () => undefined;
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

/**
 * Silences and records the Logger's errors for one test.
 * @returns The spy.
 */
const spyOnLoggedErrors = () =>
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

describe('ApiExceptionFilter in an app', () => {
  test('answers an ApiException with its status, code, message, and data', async () => {
    spyOnLoggedErrors();

    const { status, body } = await requestJson(`${server.baseUrl}/errors/api-exception`);

    expect(status).toBe(409);
    expect(body).toStrictEqual({
      success: false,
      error: { code: 'NAME_TAKEN', message: 'The name is taken.', data: { name: 'acme' } },
    });
  });

  test('answers an unknown error with a generic 500, logs it, and reports it', async () => {
    const loggedErrors = spyOnLoggedErrors();

    const { status, body } = await requestJson(`${server.baseUrl}/errors/unknown?token=abc123`);

    expect(status).toBe(500);
    expect(body).toStrictEqual({
      success: false,
      error: { code: ERRORS.INTERNAL_ERROR, message: ERROR_MESSAGES.INTERNAL_ERROR, data: null },
    });
    expect(JSON.stringify(body)).not.toContain('password');
    expect(loggedErrors).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'password authentication failed for user "app"' }),
      { method: 'GET', url: '/errors/unknown?token=[redacted]', status: 500 },
    );
    expect(report).toHaveBeenCalledOnce();
    expect(report.mock.calls[0]?.[0]).toMatchObject({
      status: 500,
      severity: undefined,
      url: '/errors/unknown?token=[redacted]',
      request: { method: 'GET' },
    });
  });

  test.each([
    ['should-log', 'EXPORT_TOO_LARGE', 500],
    ['critical', 'LEDGER_UNBALANCED', 500],
  ])('logs the %s error', async (path, code, expectedStatus) => {
    const loggedErrors = spyOnLoggedErrors();

    const { status, body } = await requestJson(`${server.baseUrl}/errors/${path}`);

    expect(status).toBe(expectedStatus);
    expect(body).toMatchObject({ error: { code } });
    expect(loggedErrors).toHaveBeenCalledWith(expect.objectContaining({ code }), {
      method: 'GET',
      url: `/errors/${path}`,
      status: expectedStatus,
    });
  });

  test('neither logs nor reports an expected error', async () => {
    const loggedErrors = spyOnLoggedErrors();

    const { status, body } = await requestJson(`${server.baseUrl}/errors/expected`);

    expect(status).toBe(404);
    expect(body).toMatchObject({ error: { code: 'PROJECT_NOT_FOUND' } });
    expect(loggedErrors).not.toHaveBeenCalled();
    expect(report).not.toHaveBeenCalled();
  });

  test('answers a reporter that fails as if it had succeeded', async () => {
    const loggedErrors = spyOnLoggedErrors();
    reportImplementation = () => Promise.reject(new Error('The tracker is down.'));

    const { status, body } = await requestJson(`${server.baseUrl}/errors/api-exception`);

    expect(status).toBe(409);
    expect(body).toMatchObject({ error: { code: 'NAME_TAKEN' } });
    await vi.waitFor(() => {
      expect(loggedErrors).toHaveBeenCalledWith(
        'The error reporter failed.',
        expect.objectContaining({ message: 'The tracker is down.' }),
        { method: 'GET', url: '/errors/api-exception', status: 409 },
      );
    });
  });

  test.each([
    ['a thrown NotFoundException', '/errors/http', 'No such project'],
    ['a route that does not exist', '/missing', 'Cannot GET /missing'],
  ])('answers %s with HTTP_EXCEPTION', async (_, path, message) => {
    const loggedErrors = spyOnLoggedErrors();

    const { status, body } = await requestJson(`${server.baseUrl}${path}`);

    expect(status).toBe(404);
    expect(body).toStrictEqual({
      success: false,
      error: { code: ERRORS.HTTP_EXCEPTION, message, data: null },
    });
    expect(loggedErrors).not.toHaveBeenCalled();
  });
});
