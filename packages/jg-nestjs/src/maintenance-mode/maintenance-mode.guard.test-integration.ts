import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter } from '../exception-filter/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { MAINTENANCE_MODE_GUARD_OPTIONS } from './constants.js';
import { MaintenanceModeGuard } from './maintenance-mode.guard.js';
import type { IMaintenanceModeState } from './types.js';

@Controller('status')
class StatusController {
  @Get()
  @UseGuards(MaintenanceModeGuard)
  public read(): { isUp: boolean } {
    return { isUp: true };
  }
}

const report = vi.fn();
const getState = vi.fn<() => IMaintenanceModeState | Promise<IMaintenanceModeState>>();
let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp({
    controllers: [StatusController],
    providers: [
      { provide: MAINTENANCE_MODE_GUARD_OPTIONS, useValue: { getState } },
      { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  });
});

afterEach(() => {
  report.mockClear();
  getState.mockReset();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

describe('MaintenanceModeGuard in an app', () => {
  test('lets requests through while maintenance is off', async () => {
    getState.mockReturnValue({ enabled: false });

    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(200);
    expect(body).toStrictEqual({ isUp: true });
  });

  test('answers with a 503 envelope holding the message, without reporting or logging it', async () => {
    const loggedErrors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    getState.mockResolvedValue({ enabled: true, message: 'Back at 14:00 UTC.' });

    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(503);
    expect(body).toStrictEqual({
      success: false,
      error: {
        code: ERRORS.MAINTENANCE_MODE,
        message: ERROR_MESSAGES.MAINTENANCE_MODE,
        data: { message: 'Back at 14:00 UTC.' },
      },
    });
    expect(report).not.toHaveBeenCalled();
    expect(loggedErrors).not.toHaveBeenCalled();
  });

  test('fails closed with a reported 500 when the state cannot be read', async () => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    getState.mockRejectedValue(new Error('The settings table is unreachable.'));

    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(500);
    expect(body).toMatchObject({ success: false, error: { code: ERRORS.INTERNAL_ERROR } });
    expect(report).toHaveBeenCalledTimes(1);
  });
});
