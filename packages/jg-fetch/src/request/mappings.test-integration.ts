import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { FetchException } from '../fetch-exception/index.js';
import { parseRetryAfterMs } from '../retry-after/index.js';
import { request } from './request.js';
import { sendJson, startTestServer, type ITestServer } from './server.test-utils.js';

// the four request modules the plan maps onto request, each written with the shipped options and
// run against a local server. Nothing migrates here: these show the options are enough.

let server: ITestServer;

// a path unique to each run of a test, so repeated runs never share request counts
let pathCounter = 0;
const uniquePath = (name: string): string => {
  pathCounter += 1;
  return `/${name}-${pathCounter}`;
};

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('moldea packages/app/api-request', () => {
  test('envelopes, a combined signal, token headers per attempt, and retries when retryable', async () => {
    const moldeaUsersMePath = uniquePath('moldea-users-me');
    server.route(moldeaUsersMePath, (request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(503).end();
        return;
      }
      sendJson(response, 200, {
        success: true,
        data: { authorization: request.headers.authorization },
        error: null,
      });
    });
    const caller = new AbortController();
    const getTokenHeaders = (): Promise<Record<string, string>> =>
      Promise.resolve({ authorization: 'Bearer id-token', 'x-firebase-appcheck': 'app-check' });
    const retryable = true;

    const { data, error } = await request<{ authorization: string }>(moldeaUsersMePath, {
      baseUrl: server.origin,
      parseAs: 'envelope',
      signal: AbortSignal.any([caller.signal, AbortSignal.timeout(15_000)]),
      headers: async () => getTokenHeaders(),
      retryDelaysSeconds: retryable ? [0, 0] : [],
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ authorization: 'Bearer id-token' });
  });

  test('App Check codes reach the app, which refreshes and maps them', async () => {
    const moldeaAppCheckPath = uniquePath('moldea-app-check');
    server.route(moldeaAppCheckPath, (_request, response) => {
      sendJson(response, 401, {
        success: false,
        error: { code: '80', message: 'The App Check token is invalid.', data: null },
      });
    });

    const { error } = await request(moldeaAppCheckPath, {
      baseUrl: server.origin,
      parseAs: 'envelope',
    });

    // the app throws toAppException(error) for React Query, mapping the code
    expect(error).toBeInstanceOf(FetchException);
    expect(error).toMatchObject({ kind: 'API_ERROR', code: '80', status: 401, attempts: 1 });
  });
});

describe('5minutes packages/app/api-request', () => {
  test('credentials, no-store caching, and an attempt timeout', async () => {
    const fiveMinutesSessionPath = uniquePath('5minutes-session');
    server.route(fiveMinutesSessionPath, (_request, response) => {
      sendJson(response, 200, { success: true, data: { signedIn: true } });
    });

    const { data, error } = await request(fiveMinutesSessionPath, {
      baseUrl: server.origin,
      parseAs: 'envelope',
      init: { credentials: 'include', cache: 'no-store' },
      attemptTimeoutSeconds: 10,
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ signedIn: true });
  });

  test('the token refresh POST retries, and GET recovery uses a longer schedule', async () => {
    const fiveMinutesRefreshPath = uniquePath('5minutes-refresh');
    server.route(fiveMinutesRefreshPath, (_request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(502).end();
        return;
      }
      sendJson(response, 200, { success: true, data: { token: 'fresh' } });
    });

    const refresh = await request(fiveMinutesRefreshPath, {
      baseUrl: server.origin,
      method: 'POST',
      parseAs: 'envelope',
      retryMethods: ['POST'],
      retryDelaysSeconds: [0],
    });
    const recovery = request(fiveMinutesRefreshPath, {
      baseUrl: server.origin,
      parseAs: 'envelope',
      retryDelaysSeconds: [2, 4, 8],
      timeoutSeconds: 20,
    });

    expect(refresh).toMatchObject({ data: { token: 'fresh' }, meta: { attempts: 2 } });
    await expect(recovery).resolves.toMatchObject({ data: { token: 'fresh' } });
  });
});

describe('moldea packages/api/external-request', () => {
  test('any method, body, headers, and query, a long timeout, a size cap, and manual redirects', async () => {
    const externalChargePath = uniquePath('external-charge');
    const externalMovedPath = uniquePath('external-moved');
    server.route(externalChargePath, (request, response) => {
      sendJson(response, 201, {
        method: request.method,
        query: request.url,
        idempotencyKey: request.headers['idempotency-key'],
        body: JSON.parse(request.body) as unknown,
      });
    });
    server.route(externalMovedPath, (_request, response) => {
      response.writeHead(302, { Location: externalChargePath }).end();
    });

    const charged = await request(`${server.origin}${externalChargePath}`, {
      method: 'POST',
      body: { amount: 100 },
      headers: { 'Idempotency-Key': 'key-1' },
      query: { expand: 'customer' },
      timeoutSeconds: 120,
      maxResponseBytes: 1_048_576,
      init: { redirect: 'manual' },
    });
    const moved = await request(`${server.origin}${externalMovedPath}`, {
      timeoutSeconds: 120,
      init: { redirect: 'manual' },
    });

    expect(charged.data).toStrictEqual({
      method: 'POST',
      query: `${externalChargePath}?expand=customer`,
      idempotencyKey: 'key-1',
      body: { amount: 100 },
    });
    // the service throws new ExternalRequestException(error)
    expect(moved.error).toMatchObject({ kind: 'HTTP_ERROR', status: 302 });
  });

  test('Turnstile retries its POST, which carries an idempotency key', async () => {
    const externalTurnstilePath = uniquePath('external-turnstile');
    server.route(externalTurnstilePath, (_request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(503).end();
        return;
      }
      sendJson(response, 200, { success: true });
    });

    const { data, meta } = await request(`${server.origin}${externalTurnstilePath}`, {
      method: 'POST',
      body: new URLSearchParams({ secret: 'secret', response: 'token', idempotency_key: 'key-1' }),
      retryMethods: ['POST'],
      retryDelaysSeconds: [0],
    });

    expect(data).toStrictEqual({ success: true });
    expect(meta.attempts).toBe(2);
  });
});

describe('5minutes packages/api/external-request', () => {
  test('no retries under the provider queue, which reads Retry-After and cf-ray from the error', async () => {
    const providerMessagesPath = uniquePath('provider-messages');
    server.route(providerMessagesPath, (_request, response) => {
      response.writeHead(429, { 'Retry-After': '7', 'cf-ray': '8f1d2c3b4a5e6f70-IAD' }).end();
    });

    const { error } = await request(`${server.origin}${providerMessagesPath}`, {
      retryDelaysSeconds: [],
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', status: 429, retryAfterMs: 7_000 });
    expect(error?.headers?.get('cf-ray')).toBe('8f1d2c3b4a5e6f70-IAD');
    // a WebSocket handshake's headers arrive as arrays
    expect(parseRetryAfterMs(['7'])).toBe(7_000);
  });
});
