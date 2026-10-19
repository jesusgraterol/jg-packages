import { Controller, Get, HttpCode } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { ApiResponseInterceptor } from './api-response.interceptor.js';

@Controller('projects')
class ProjectsController {
  @Get()
  public list(): { id: number; name: string }[] {
    return [{ id: 1, name: 'acme' }];
  }

  @Get('nothing')
  public nothing(): void {
    return undefined;
  }

  @Get('empty')
  @HttpCode(204)
  public empty(): { ignored: boolean } {
    return { ignored: true };
  }
}

let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp({
    controllers: [ProjectsController],
    providers: [{ provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor }],
  });
});

afterAll(async () => {
  await server.close();
});

describe('ApiResponseInterceptor in an app', () => {
  test("wraps a handler's result in the success envelope", async () => {
    const { status, body } = await requestJson(`${server.baseUrl}/projects`);

    expect(status).toBe(200);
    expect(body).toStrictEqual({ success: true, data: [{ id: 1, name: 'acme' }], error: null });
  });

  test('sends the envelope without data when the handler returns nothing', async () => {
    const { body } = await requestJson(`${server.baseUrl}/projects/nothing`);

    expect(body).toStrictEqual({ success: true, error: null });
  });

  test('sends no body for a 204', async () => {
    const { status, body } = await requestJson(`${server.baseUrl}/projects/empty`);

    expect(status).toBe(204);
    expect(body).toBeUndefined();
  });
});
