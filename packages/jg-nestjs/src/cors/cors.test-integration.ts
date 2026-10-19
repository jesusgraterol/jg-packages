import { Controller, Get, Logger } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter } from '../exception-filter/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { createCorsOptions } from './cors.js';

@Controller('status')
class StatusController {
  @Get()
  public read(): { isUp: boolean } {
    return { isUp: true };
  }
}

const report = vi.fn();
let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp(
    {
      controllers: [StatusController],
      providers: [
        { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    },
    (app) => {
      app.enableCors(createCorsOptions({ origins: ['https://app.example.com'] }));
    },
  );
});

afterEach(() => {
  report.mockClear();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

describe('createCorsOptions in an app', () => {
  test('lets an allowed origin through, with its CORS header', async () => {
    const { status, headers } = await requestJson(`${server.baseUrl}/status`, {
      headers: { origin: 'https://www.app.example.com' },
    });

    expect(status).toBe(200);
    expect(headers.get('access-control-allow-origin')).toBe('https://www.app.example.com');
  });

  test('answers an allowed preflight with 204', async () => {
    const { status, headers } = await requestJson(`${server.baseUrl}/status`, {
      method: 'OPTIONS',
      headers: { origin: 'https://app.example.com', 'access-control-request-method': 'PATCH' },
    });

    expect(status).toBe(204);
    expect(headers.get('access-control-allow-methods')).toBe('GET,HEAD,PUT,PATCH,POST,DELETE');
  });

  test('lets a request without an origin through', async () => {
    const { status } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(200);
  });

  test('answers another origin with a 403 envelope through the filter, without reporting it', async () => {
    const loggedErrors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { status, headers, body } = await requestJson(`${server.baseUrl}/status`, {
      headers: { origin: 'https://evil.test' },
    });

    expect(status).toBe(403);
    expect(headers.get('access-control-allow-origin')).toBeNull();
    expect(body).toStrictEqual({
      success: false,
      error: {
        code: ERRORS.CORS_ORIGIN_NOT_ALLOWED,
        message: ERROR_MESSAGES.CORS_ORIGIN_NOT_ALLOWED,
        data: null,
      },
    });
    expect(report).not.toHaveBeenCalled();
    expect(loggedErrors).not.toHaveBeenCalled();
  });
});
