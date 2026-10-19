import { Body, Controller, Get, Logger, Post, Req, VersioningType } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { raw } from 'express';
import helmet from 'helmet';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { ApiExceptionFilter } from '../exception-filter/index.js';
import { ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { configureHttpApp } from './configure-http-app.js';

@Controller('echo')
class EchoController {
  @Post()
  public echo(@Body() body: unknown): unknown {
    return body;
  }

  @Get('ip')
  public readIp(@Req() request: { ip?: string }): { ip: string | undefined } {
    return { ip: request.ip };
  }
}

@Controller('webhooks')
class WebhooksController {
  @Post('billing')
  public receive(@Body() body: unknown): { isBuffer: boolean; text: string } {
    return { isBuffer: Buffer.isBuffer(body), text: String(body) };
  }
}

@Controller({ path: 'projects', version: '2' })
class ProjectsV2Controller {
  @Get()
  public list(): string[] {
    return ['acme'];
  }
}

let server: ITestHttpApp;

beforeAll(async () => {
  server = await startHttpApp(
    {
      controllers: [EchoController, WebhooksController, ProjectsV2Controller],
      providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
    },
    (app) => {
      const expressApp = app as NestExpressApplication;
      // registered before configureHttpApp, the way a webhook route keeps its raw body
      expressApp.use('/webhooks/billing', raw({ type: 'application/json' }));
      configureHttpApp(expressApp, {
        bodyLimit: '1kb',
        securityMiddleware: helmet(),
        trustProxyHops: 1,
        requestLogging: { redactUrl: (url) => url.replace(/token=\w+/, 'token=[redacted]') },
        versioning: { type: VersioningType.URI },
      });
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await server.close();
});

/**
 * Posts a JSON body to a path of the app.
 * @param path The path.
 * @param json The body, as written.
 * @returns A promise that resolves to the response.
 */
const postJson = (path: string, json: string) =>
  requestJson(`${server.baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: json,
  });

describe('configureHttpApp in an app', () => {
  test('parses a JSON body within the limit, and answers a larger one with a 413 the filter sends', async () => {
    const loggedErrors = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const small = await postJson('/echo', JSON.stringify({ name: 'acme' }));
    const large = await postJson('/echo', JSON.stringify({ name: 'x'.repeat(2048) }));

    expect(small).toMatchObject({ status: 201, body: { name: 'acme' } });
    expect(large).toMatchObject({
      status: 413,
      body: {
        success: false,
        error: { code: ERRORS.HTTP_EXCEPTION, message: 'request entity too large', data: null },
      },
    });
    expect(loggedErrors).not.toHaveBeenCalled();
  });

  test('gives a route registered first its raw body as a Buffer', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const { status, body } = await postJson('/webhooks/billing', '{"event":"paid"}');

    expect(status).toBe(201);
    expect(body).toStrictEqual({ isBuffer: true, text: '{"event":"paid"}' });
  });

  test("reads the client's address through the trusted proxy hop", async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const { body } = await requestJson(`${server.baseUrl}/echo/ip`, {
      headers: { 'x-forwarded-for': '198.51.100.20, 203.0.113.7' },
    });

    expect(body).toStrictEqual({ ip: '203.0.113.7' });
  });

  test("sets the security middleware's headers", async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const { headers } = await requestJson(`${server.baseUrl}/echo/ip`);

    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('x-powered-by')).toBeNull();
  });

  test('serves versioned routes under their URI version', async () => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const versioned = await requestJson(`${server.baseUrl}/v2/projects`);
    const unversioned = await requestJson(`${server.baseUrl}/projects`);

    expect(versioned).toMatchObject({ status: 200, body: ['acme'] });
    expect(unversioned.status).toBe(404);
  });

  test('writes the request log, redacted, once the response finishes', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    await requestJson(`${server.baseUrl}/echo/ip?token=abc123`, {
      headers: { 'user-agent': 'integration-test', 'x-forwarded-for': '203.0.113.7' },
    });

    await vi.waitFor(() => {
      expect(log).toHaveBeenCalledWith(
        expect.stringMatching(/^GET \/echo\/ip\?token=\[redacted\] 200 \d+ms$/),
        expect.objectContaining({ ip: '203.0.113.7', userAgent: 'integration-test' }),
      );
    });
    expect(log.mock.contexts.at(-1)).toMatchObject({ context: 'HTTP' });
  });
});
