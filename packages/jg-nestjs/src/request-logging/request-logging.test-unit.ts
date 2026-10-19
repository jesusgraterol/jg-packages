import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createRequestLoggingMiddleware } from './request-logging.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Builds a request as Node.js or Express hands it over.
 * @param fields What to change.
 * @returns The request.
 */
const createRequest = (fields: Record<string, unknown> = {}): IncomingMessage =>
  ({
    method: 'GET',
    url: '/projects?token=abc',
    headers: {},
    socket: { remoteAddress: '10.0.0.5' },
    ...fields,
  }) as unknown as IncomingMessage;

/**
 * Builds a response that finishes when the test emits `finish`.
 * @param statusCode Its status.
 * @param headers Its headers.
 * @returns The response.
 */
const createResponse = (
  statusCode: number,
  headers: Record<string, string | number> = {},
): ServerResponse =>
  Object.assign(new EventEmitter(), {
    statusCode,
    getHeader: (name: string) => headers[name],
  }) as unknown as ServerResponse;

/**
 * Spies on every level the middleware logs at, silencing them.
 * @returns The spies.
 */
const spyOnLevels = () => ({
  log: vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
  warn: vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
  error: vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined),
});

describe('createRequestLoggingMiddleware', () => {
  test('logs nothing until the response finishes, and calls next at once', () => {
    const levels = spyOnLevels();
    const next = vi.fn();

    createRequestLoggingMiddleware()(createRequest(), createResponse(200), next);

    expect(next).toHaveBeenCalledOnce();
    expect(levels.log).not.toHaveBeenCalled();
  });

  test.each([
    [200, 'log'],
    [304, 'log'],
    [404, 'warn'],
    [499, 'warn'],
    [500, 'error'],
    [503, 'error'],
  ] as const)('logs a %d at %s', (status, level) => {
    const levels = spyOnLevels();
    const response = createResponse(status);

    createRequestLoggingMiddleware()(createRequest(), response, () => undefined);
    response.emit('finish');

    expect(levels[level]).toHaveBeenCalledOnce();
    expect(levels[level]).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^GET /projects\\?token=abc ${String(status)} \\d+ms$`)),
      { ip: '10.0.0.5' },
    );
  });

  test("logs Express's original URL and address, redacted, with the known fields, under its context", () => {
    const levels = spyOnLevels();
    const response = createResponse(201, { 'content-length': '512' });
    const redactUrl = (url: string): string => url.replace(/token=\w+/, 'token=[redacted]');

    createRequestLoggingMiddleware({ context: 'Billing', redactUrl })(
      createRequest({
        method: 'POST',
        url: '/v1/charges',
        originalUrl: '/api/v1/charges?token=abc',
        ip: '203.0.113.7',
        headers: {
          'user-agent': 'curl/8.5.0',
          referer: 'https://app.example.com/pay?token=xyz',
        },
      }),
      response,
      () => undefined,
    );
    response.emit('finish');

    expect(levels.log).toHaveBeenCalledWith(
      expect.stringMatching(/^POST \/api\/v1\/charges\?token=\[redacted\] 201 \d+ms$/),
      {
        ip: '203.0.113.7',
        userAgent: 'curl/8.5.0',
        referer: 'https://app.example.com/pay?token=[redacted]',
        responseSize: 512,
      },
    );
    expect(levels.log.mock.contexts[0]).toMatchObject({ context: 'Billing' });
  });

  test('leaves out what it doesn’t know, such as a missing address or a size that isn’t a number', () => {
    const levels = spyOnLevels();
    const response = createResponse(200, { 'content-length': 'chunked' });

    createRequestLoggingMiddleware()(
      createRequest({
        method: undefined,
        url: undefined,
        socket: {},
        headers: { 'user-agent': '' },
      }),
      response,
      () => undefined,
    );
    response.emit('finish');

    expect(levels.log).toHaveBeenCalledWith(expect.stringMatching(/^UNKNOWN {2}200 \d+ms$/), {});
  });
});
