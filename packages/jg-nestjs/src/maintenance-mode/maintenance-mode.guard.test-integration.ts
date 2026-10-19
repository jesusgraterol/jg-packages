import {
  type ExecutionContext,
  Controller,
  Get,
  Logger,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { APP_FILTER, Reflector } from '@nestjs/core';
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

// the metadata key a route sets to stay up during maintenance
const MAINTENANCE_EXEMPT = 'maintenance-exempt';

@Controller('admin')
@UseGuards(MaintenanceModeGuard)
class AdminController {
  @Get('sign-in')
  @SetMetadata(MAINTENANCE_EXEMPT, true)
  public signIn(): { isUp: boolean } {
    return { isUp: true };
  }

  @Get('users')
  public listUsers(): { users: string[] } {
    return { users: [] };
  }
}

const report = vi.fn();
const getState =
  vi.fn<(context: ExecutionContext) => IMaintenanceModeState | Promise<IMaintenanceModeState>>();
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

  test('answers with a Moldea-shaped data exactly as the state gives it', async () => {
    const data = {
      maintenanceMode: { content: 'Back at 14:00 UTC.', updatedAt: '2026-10-19T12:00:00.000Z' },
    };
    getState.mockResolvedValue({ enabled: true, message: 'ignored', data });

    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(503);
    expect(body).toStrictEqual({
      success: false,
      error: { code: ERRORS.MAINTENANCE_MODE, message: ERROR_MESSAGES.MAINTENANCE_MODE, data },
    });
  });

  test('answers with null data when the data cannot be serialized', async () => {
    getState.mockReturnValue({ enabled: true, data: { count: 10n } as never });

    const { status, body } = await requestJson(`${server.baseUrl}/status`);

    expect(status).toBe(503);
    expect(body).toMatchObject({ error: { code: ERRORS.MAINTENANCE_MODE, data: null } });
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

describe('MaintenanceModeGuard with a per-route exemption', () => {
  let exemptServer: ITestHttpApp;

  beforeAll(async () => {
    exemptServer = await startHttpApp({
      controllers: [AdminController],
      providers: [
        {
          provide: MAINTENANCE_MODE_GUARD_OPTIONS,
          useFactory: (reflector: Reflector) => ({
            getState: (context: ExecutionContext): IMaintenanceModeState => ({
              enabled:
                reflector.get<boolean | undefined>(MAINTENANCE_EXEMPT, context.getHandler()) !==
                true,
              message: 'Back at 14:00 UTC.',
            }),
          }),
          inject: [Reflector],
        },
        { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
      ],
    });
  });

  afterAll(async () => {
    await exemptServer.close();
  });

  test('lets the exempt route through and refuses the others', async () => {
    const signIn = await requestJson(`${exemptServer.baseUrl}/admin/sign-in`);
    const users = await requestJson(`${exemptServer.baseUrl}/admin/users`);

    expect(signIn).toMatchObject({ status: 200, body: { isUp: true } });
    expect(users).toMatchObject({
      status: 503,
      body: { error: { code: ERRORS.MAINTENANCE_MODE, data: { message: 'Back at 14:00 UTC.' } } },
    });
  });
});
