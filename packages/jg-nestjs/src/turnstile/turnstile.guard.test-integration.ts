import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { Controller, Get, Module, UseGuards } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  API_EXCEPTION_FILTER_OPTIONS,
  ApiExceptionFilter,
  type IErrorReport,
} from '../exception-filter/index.js';
import { ERRORS } from '../shared/index.js';
import { requestJson, startHttpApp, type ITestHttpApp } from '../test-utils/http-app.js';
import { SITEVERIFY_URL, TURNSTILE_GUARD_OPTIONS, TURNSTILE_TOKEN_HEADER } from './constants.js';
import { TurnstileAction } from './turnstile-action.decorator.js';
import { TurnstileGuard } from './turnstile.guard.js';

@Controller('forms')
@UseGuards(TurnstileGuard)
class FormsController {
  @Get('open')
  public open(): { form: string } {
    return { form: 'open' };
  }

  @Get('contact')
  @TurnstileAction('contact')
  public contact(): { form: string } {
    return { form: 'contact' };
  }
}

@Module({
  controllers: [FormsController],
  providers: [
    {
      provide: TURNSTILE_GUARD_OPTIONS,
      useValue: { secretKey: 'secret-key', allowedHostnames: ['app.example.com'] },
    },
    TurnstileGuard,
  ],
})
class FormsModule {}

// what the stub received: each request's form fields
const received: URLSearchParams[] = [];

// what the stub answers each request with, in order; the last one repeats
let answers: { status: number; body: unknown }[] = [];

const answerSiteverify = async (request: IncomingMessage, response: ServerResponse) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  received.push(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
  const { status, body } = answers[Math.min(received.length, answers.length) - 1] ?? {
    status: 500,
    body: {},
  };
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const report = vi.fn<(errorReport: IErrorReport) => void>();
let stub: Server;
let server: ITestHttpApp;

beforeAll(async () => {
  stub = createServer((request, response) => void answerSiteverify(request, response));
  await new Promise<void>((resolve) => stub.listen(0, '127.0.0.1', resolve));
  const stubUrl = `http://127.0.0.1:${(stub.address() as { port: number }).port}/siteverify`;
  // sends the guard's siteverify calls to the stub, and everything else where it was going
  const realFetch = globalThis.fetch;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const original = new Request(input, init);
    if (original.url !== SITEVERIFY_URL) {
      return realFetch(original);
    }
    return realFetch(stubUrl, {
      method: original.method,
      headers: original.headers,
      body: await original.arrayBuffer(),
      signal: original.signal,
      redirect: original.redirect,
    });
  });
  server = await startHttpApp({
    imports: [FormsModule],
    providers: [
      { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
      { provide: APP_FILTER, useClass: ApiExceptionFilter },
    ],
  });
});

afterAll(async () => {
  await server.close();
  await new Promise<void>((resolve) => stub.close(() => resolve()));
  vi.restoreAllMocks();
});

afterEach(() => {
  received.length = 0;
  answers = [];
  report.mockClear();
});

/**
 * Calls a guarded route with a token.
 * @param route The route, under /forms.
 * @param token The token header's value, or null for none.
 * @returns A promise that resolves to the status and the parsed body.
 */
const callForm = (route: string, token: string | null = 'token-1') =>
  requestJson(`${server.baseUrl}/forms/${route}`, {
    headers: token === null ? {} : { [TURNSTILE_TOKEN_HEADER]: token },
  });

// the body of every refusal: the code and message, and nothing Cloudflare said
const failedBody = {
  success: false,
  error: { code: ERRORS.TURNSTILE_FAILED, message: 'The human verification failed.', data: null },
};
const unavailableBody = {
  success: false,
  error: {
    code: ERRORS.TURNSTILE_UNAVAILABLE,
    message: 'Human verification is temporarily unavailable. Try again shortly.',
    data: null,
  },
};

/**
 * Answers siteverify's requests with a successful verification.
 * @param fields The answer's other fields.
 */
const answerSuccess = (fields: Record<string, unknown> = {}): void => {
  answers = [
    {
      status: 200,
      body: { success: true, 'error-codes': [], hostname: 'app.example.com', ...fields },
    },
  ];
};

describe('TurnstileGuard', () => {
  test('lets a verified request through, sending the secret, the token, and an idempotency key', async () => {
    answerSuccess();

    const response = await callForm('open');

    expect(response).toMatchObject({ status: 200, body: { form: 'open' } });
    expect(received).toHaveLength(1);
    expect(received[0]?.get('secret')).toBe('secret-key');
    expect(received[0]?.get('response')).toBe('token-1');
    expect(received[0]?.get('idempotency_key')).toMatch(/^[0-9a-f-]{36}$/);
  });

  test("tolerates fields siteverify adds, and checks the route's action", async () => {
    answerSuccess({
      action: 'contact',
      cdata: 'session-1',
      challenge_ts: '2026-10-20T10:00:00.000Z',
      metadata: { interactive: true },
      a_future_field: [1, 2],
    });

    expect((await callForm('contact')).status).toBe(200);
  });

  test('retries a failed siteverify call with the same idempotency key', async () => {
    answers = [
      { status: 503, body: {} },
      { status: 200, body: { success: true, 'error-codes': [], hostname: 'app.example.com' } },
    ];

    expect((await callForm('open')).status).toBe(200);
    expect(received).toHaveLength(2);
    expect(received[1]?.get('idempotency_key')).toBe(received[0]?.get('idempotency_key'));
    expect(received[0]?.get('idempotency_key')).not.toBe(null);
  });

  test.each([
    ['without a token', null],
    ['with an empty token', ''],
    ['with a token longer than 2048 characters', 'x'.repeat(2049)],
  ])('refuses a request %s with a 403 before calling siteverify', async (_, token) => {
    answerSuccess();

    const response = await callForm('open', token);

    expect(response).toMatchObject({
      status: 403,
      body: { error: { code: ERRORS.TURNSTILE_FAILED } },
    });
    expect(response.body).toStrictEqual(failedBody);
    expect(received).toHaveLength(0);
  });

  test.each([
    ['without a hostname', { hostname: undefined }],
    ['from a hostname not allowed', { hostname: 'evil.example.com' }],
  ])('refuses a verification %s with a 403, unreported', async (_, fields) => {
    answerSuccess(fields);

    const response = await callForm('open');

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual(failedBody);
    expect(report).not.toHaveBeenCalled();
  });

  test.each([
    ['another action', { action: 'signup' }],
    ['no action', {}],
  ])('refuses a verification for %s on a route that sets one', async (_, fields) => {
    answerSuccess(fields);

    const response = await callForm('contact');

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual(failedBody);
  });

  test.each([['invalid-input-response'], ['timeout-or-duplicate'], ['missing-input-response']])(
    'answers siteverify refusing the token with %s as a 403, unreported',
    async (code) => {
      answers = [{ status: 200, body: { success: false, 'error-codes': [code], messages: ['x'] } }];

      const response = await callForm('open');

      expect(response.status).toBe(403);
      expect(response.body).toStrictEqual(failedBody);
      expect(report).not.toHaveBeenCalled();
    },
  );

  test.each([[['invalid-input-secret']], [['internal-error']], [[]]])(
    'answers siteverify refusing with %j as a 503, reported with the codes in its cause',
    async (codes) => {
      answers = [{ status: 200, body: { success: false, 'error-codes': codes } }];

      const response = await callForm('open');

      expect(response.status).toBe(503);
      expect(response.body).toStrictEqual(unavailableBody);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0]?.[0].error).toMatchObject({
        code: ERRORS.TURNSTILE_UNAVAILABLE,
        cause: { data: { errorCodes: codes } },
      });
    },
  );

  test.each([
    ['an answer of another shape', { status: 200, body: { success: 'yes', 'error-codes': [] } }],
    [
      'error codes that are not strings',
      { status: 200, body: { success: false, 'error-codes': [7] } },
    ],
    ['a body that is not JSON', { status: 200, body: '<html>' }],
    ['an answer that is not an object', { status: 200, body: 'null' }],
    ['a client error', { status: 400, body: { message: 'secret=secret-key' } }],
  ])('answers %s as a 503, reported, without what siteverify said', async (_, answer) => {
    answers = [answer];

    const response = await callForm('open');

    expect(response.status).toBe(503);
    expect(response.body).toStrictEqual(unavailableBody);
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]?.[0]).toMatchObject({
      status: 503,
      error: { code: ERRORS.TURNSTILE_UNAVAILABLE },
    });
  });
});
