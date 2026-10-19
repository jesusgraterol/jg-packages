import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter } from '../exception-filter/index.js';
import { configureHttpApp } from '../http-app/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { IP_BLOCKLIST_GUARD_OPTIONS } from './constants.js';
import { IpBlocklistGuard } from './ip-blocklist.guard.js';

@Controller('status')
class StatusController {
  @Get()
  @UseGuards(IpBlocklistGuard)
  public read(): { isUp: boolean } {
    return { isUp: true };
  }
}

const report = vi.fn();
const BLOCKED_IPS = new Set(['203.0.113.7']);
const isBlocked = vi.fn((ip: string) => BLOCKED_IPS.has(ip));
let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp(
    {
      controllers: [StatusController],
      providers: [
        { provide: IP_BLOCKLIST_GUARD_OPTIONS, useValue: { isBlocked } },
        { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    },
    (app) => {
      configureHttpApp(app as NestExpressApplication, {
        bodyLimit: '1kb',
        trustProxyHops: 1,
        requestLogging: false,
        shutdownSignals: [],
      });
    },
  );
});

afterEach(() => {
  report.mockClear();
  isBlocked.mockClear();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

describe('IpBlocklistGuard in an app', () => {
  test('answers a blocked address from X-Forwarded-For, one proxy hop trusted, with a 403 envelope, unreported', async () => {
    const loggedErrors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const { status, body } = await requestJson(`${server.baseUrl}/status`, {
      headers: { 'x-forwarded-for': '203.0.113.7' },
    });

    expect(status).toBe(403);
    expect(body).toStrictEqual({
      success: false,
      error: { code: ERRORS.IP_BLOCKED, message: ERROR_MESSAGES.IP_BLOCKED, data: null },
    });
    expect(isBlocked).toHaveBeenCalledWith('203.0.113.7');
    expect(report).not.toHaveBeenCalled();
    expect(loggedErrors).not.toHaveBeenCalled();
  });

  test('trusts only the last hop, so an address the client forged further left is ignored', async () => {
    const { status } = await requestJson(`${server.baseUrl}/status`, {
      headers: { 'x-forwarded-for': '203.0.113.7, 198.51.100.9' },
    });

    expect(status).toBe(200);
    expect(isBlocked).toHaveBeenCalledWith('198.51.100.9');
  });

  test('lets a direct request through, checking its socket address', async () => {
    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(200);
    expect(body).toStrictEqual({ isUp: true });
    expect(isBlocked).toHaveBeenCalledWith('127.0.0.1');
  });
});
