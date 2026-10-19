import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { FetchException } from '../fetch-exception/index.js';
import { ERROR_MESSAGES } from '../shared/index.js';
import { request } from './request.js';
import { sendJson, startTestServer, type ITestServer } from './server.test-utils.js';

let server: ITestServer;

// a path unique to each test, so their routes and request counts never mix
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

describe('successful requests', () => {
  test('reads JSON, appends the query, and reports the meta without the query', async () => {
    const path = uniquePath('users');
    server.route(path, (_request, response) => {
      sendJson(response, 200, { id: 1 }, { 'X-Request-Id': 'abc' });
    });

    const { data, error, meta } = await request(`${server.origin}${path}?key=secret`, {
      query: { page: 2, tags: ['a', 'b'], empty: '' },
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ id: 1 });
    expect(server.requests(path)[0]?.url).toBe(`${path}?key=secret&page=2&tags=a&tags=b`);
    expect(meta).toMatchObject({ status: 200, url: `${server.origin}${path}`, attempts: 1 });
    expect(meta.headers?.get('x-request-id')).toBe('abc');
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('reads text, bytes, blobs, the response itself, or nothing', async () => {
    const path = uniquePath('file');
    server.route(path, (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end('hello');
    });
    const url = `${server.origin}${path}`;

    const text = await request(url, { parseAs: 'text' });
    const bytes = await request(url, { parseAs: 'bytes' });
    const blob = await request(url, { parseAs: 'blob' });
    const response = await request(url, { parseAs: 'response' });
    const none = await request(url, { parseAs: 'none' });

    expect(text.data).toBe('hello');
    expect(bytes.data).toStrictEqual(new TextEncoder().encode('hello'));
    expect(await blob.data?.text()).toBe('hello');
    expect(blob.data?.type).toBe('text/plain');
    expect(response.data?.bodyUsed).toBe(false);
    expect(await response.data?.text()).toBe('hello');
    expect(none).toMatchObject({ data: undefined, error: null });
  });

  test('gives undefined for a 204 and for a HEAD request', async () => {
    const path = uniquePath('empty');
    server.route(path, (request, response) => {
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '13' });
        response.end();
        return;
      }
      response.writeHead(204).end();
    });

    const noContent = await request(`${server.origin}${path}`);
    const head = await request(`${server.origin}${path}`, { method: 'HEAD' });
    const envelope = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(noContent).toMatchObject({ data: undefined, error: null, meta: { status: 204 } });
    expect(head).toMatchObject({ data: undefined, error: null, meta: { status: 200 } });
    expect(envelope).toMatchObject({ data: undefined, error: null });
  });

  test('sends plain objects as JSON and FormData without forcing a content type', async () => {
    const path = uniquePath('echo');
    server.route(path, (request, response) => {
      sendJson(response, 200, { contentType: request.headers['content-type'], body: request.body });
    });
    const url = `${server.origin}${path}`;
    const formData = new FormData();
    formData.append('name', 'Ada');

    const json = await request<{ contentType: string; body: string }>(url, {
      method: 'POST',
      body: { name: 'Ada' },
    });
    const custom = await request<{ contentType: string }>(url, {
      method: 'PUT',
      body: [1],
      headers: { 'Content-Type': 'application/vnd.api+json' },
    });
    const form = await request<{ contentType: string; body: string }>(url, {
      method: 'POST',
      body: formData,
    });

    expect(json.data).toStrictEqual({ contentType: 'application/json', body: '{"name":"Ada"}' });
    expect(custom.data?.contentType).toBe('application/vnd.api+json');
    expect(form.data?.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(form.data?.body).toContain('Ada');
  });

  test('reports a body fetch would turn into text as INVALID_BODY, without sending it', async () => {
    const path = uniquePath('unsendable');
    let received = 0;
    server.route(path, (_request, response) => {
      received += 1;
      sendJson(response, 200, { ok: true });
    });
    const url = `${server.origin}${path}`;

    const results = await Promise.all([
      request(url, { method: 'POST', body: Symbol('body') as never }),
      request(url, { method: 'POST', body: new Map([['a', 1]]) as never }),
    ]);

    for (const { data, error, meta } of results) {
      expect(data).toBeNull();
      expect(error).toMatchObject({ kind: 'INVALID_BODY', attempts: 0 });
      expect(meta.status).toBeNull();
    }
    expect(received).toBe(0);
  });

  test('builds the headers again for every attempt', async () => {
    const path = uniquePath('token');
    server.route(path, (request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(503).end();
        return;
      }
      sendJson(response, 200, { authorization: request.headers.authorization });
    });
    const headers = vi.fn(({ attempt }: { attempt: number }) =>
      Promise.resolve({ authorization: `Bearer token-${attempt}` }),
    );

    const { data } = await request(`${server.origin}${path}`, {
      headers,
      retryDelaysSeconds: [0],
    });

    expect(data).toStrictEqual({ authorization: 'Bearer token-2' });
    expect(headers).toHaveBeenCalledTimes(2);
  });
});

describe('envelopes', () => {
  test('resolves to the data of a successful envelope, with error null or missing', async () => {
    const path = uniquePath('envelope');
    server.route(path, (_request, response, attempt) => {
      sendJson(
        response,
        200,
        attempt === 1
          ? { success: true, data: { id: 1 }, error: null }
          : { success: true, data: 2 },
      );
    });

    const first = await request(`${server.origin}${path}`, { parseAs: 'envelope' });
    const second = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(first).toMatchObject({ data: { id: 1 }, error: null });
    expect(second).toMatchObject({ data: 2, error: null });
  });

  test("reports a failed envelope as API_ERROR with the envelope error's code, message, and data", async () => {
    const path = uniquePath('api-error');
    server.route(path, (_request, response, attempt) => {
      if (attempt === 1) {
        sendJson(response, 404, {
          success: false,
          data: { partial: true },
          error: { code: 'USER_NOT_FOUND', message: 'The user was not found.', data: { id: 7 } },
        });
        return;
      }
      if (attempt === 2) {
        sendJson(response, 200, {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Slow down.' },
        });
        return;
      }
      sendJson(response, 200, { success: false, error: null });
    });

    const notFound = await request(`${server.origin}${path}`, { parseAs: 'envelope' });
    const withoutData = await request(`${server.origin}${path}`, { parseAs: 'envelope' });
    const withoutError = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(notFound.error).toBeInstanceOf(FetchException);
    expect(notFound.error).toMatchObject({
      kind: 'API_ERROR',
      code: 'USER_NOT_FOUND',
      message: 'The user was not found.',
      data: { id: 7 },
      body: {
        success: false,
        data: { partial: true },
        error: { code: 'USER_NOT_FOUND', message: 'The user was not found.', data: { id: 7 } },
      },
      status: 404,
      attempts: 1,
    });
    expect(withoutData.error).toMatchObject({
      kind: 'API_ERROR',
      code: 'RATE_LIMITED',
      message: 'Slow down.',
      data: null,
      status: 200,
    });
    expect(withoutError.error).toMatchObject({
      kind: 'API_ERROR',
      code: 'API_ERROR',
      message: ERROR_MESSAGES.API_ERROR,
      data: null,
      status: 200,
    });
  });

  test('reports an envelope whose error is a string as ENVELOPE_INVALID', async () => {
    const path = uniquePath('string-error');
    server.route(path, (_request, response) => {
      sendJson(response, 200, { success: false, error: 'Not found' });
    });

    const { error } = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(error).toMatchObject({ kind: 'ENVELOPE_INVALID', code: 'ENVELOPE_INVALID' });
  });

  test('reports an HTML 502 as HTTP_ERROR with its body', async () => {
    const path = uniquePath('bad-gateway');
    server.route(path, (_request, response) => {
      response.writeHead(502, { 'Content-Type': 'text/html' }).end('<h1>Bad Gateway</h1>');
    });

    const { error } = await request(`${server.origin}${path}`, {
      parseAs: 'envelope',
      retryDelaysSeconds: [],
    });

    expect(error).toMatchObject({
      kind: 'HTTP_ERROR',
      code: 'HTTP_ERROR',
      status: 502,
      body: '<h1>Bad Gateway</h1>',
      message: 'The server returned an unsuccessful status: 502.',
    });
  });

  test.each(['bytes', 'blob'] as const)(
    'reports a failed status read as %s as HTTP_ERROR with its body as text',
    async (parseAs) => {
      const path = uniquePath(`gone-${parseAs}`);
      server.route(path, (_request, response) => {
        response.writeHead(410, { 'Content-Type': 'text/plain' }).end('Gone for good');
      });

      const { data, error } = await request(`${server.origin}${path}`, {
        parseAs,
        retryDelaysSeconds: [],
      });

      expect(data).toBeNull();
      expect(error).toMatchObject({
        kind: 'HTTP_ERROR',
        code: 'HTTP_ERROR',
        status: 410,
        body: 'Gone for good',
      });
    },
  );

  test('reports a failed status whose JSON is not an envelope as HTTP_ERROR', async () => {
    const path = uniquePath('not-envelope-error');
    server.route(path, (_request, response) => {
      sendJson(response, 404, { message: 'Not here' });
    });

    const { error } = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(error).toMatchObject({
      kind: 'HTTP_ERROR',
      code: 'HTTP_ERROR',
      status: 404,
      body: { message: 'Not here' },
    });
  });

  test('reports a successful body that is not JSON or not an envelope', async () => {
    const path = uniquePath('not-envelope');
    server.route(path, (_request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(200, { 'Content-Type': 'text/html' }).end('<html></html>');
        return;
      }
      sendJson(response, 200, { id: 1 });
    });

    const html = await request(`${server.origin}${path}`, { parseAs: 'envelope' });
    const plain = await request(`${server.origin}${path}`, { parseAs: 'envelope' });

    expect(html.error).toMatchObject({ kind: 'PARSE_ERROR', status: 200 });
    expect(html.error?.message).toBe('The response body could not be parsed.');
    expect(plain.error).toMatchObject({ kind: 'ENVELOPE_INVALID', body: { id: 1 } });
  });

  test('validates the data with the schema', async () => {
    const path = uniquePath('schema');
    server.route(path, (_request, response) => {
      sendJson(response, 200, { success: true, data: { id: 'one' } });
    });
    const schema = {
      parse: (value: unknown): { id: number } => {
        if (
          typeof value !== 'object' ||
          value === null ||
          !('id' in value) ||
          typeof value.id !== 'number'
        ) {
          throw new Error('id must be a number');
        }
        return { id: value.id };
      },
    };

    const { error } = await request(`${server.origin}${path}`, { parseAs: 'envelope', schema });

    expect(error).toMatchObject({ kind: 'RESPONSE_INVALID', status: 200 });
    expect(error?.cause).toStrictEqual(new Error('id must be a number'));
  });
});

describe('retries', () => {
  test('retries a retryable status, then succeeds', async () => {
    const path = uniquePath('flaky');
    server.route(path, (_request, response, attempt) => {
      if (attempt < 3) {
        response.writeHead(503).end('busy');
        return;
      }
      sendJson(response, 200, { ok: true });
    });
    const onRetry = vi.fn();

    const { data, meta } = await request(`${server.origin}${path}`, {
      retryDelaysSeconds: [0.05, 0.05],
      onRetry,
    });

    expect(data).toStrictEqual({ ok: true });
    expect(meta.attempts).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test('stops with the last failure once the schedule runs out', async () => {
    const path = uniquePath('down');
    server.route(path, (_request, response) => {
      response.writeHead(500).end();
    });

    const { error, meta } = await request(`${server.origin}${path}`, {
      retryDelaysSeconds: [0, 0],
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', status: 500, attempts: 3 });
    expect(meta.attempts).toBe(3);
    expect(server.requests(path)).toHaveLength(3);
  });

  test('never retries a POST by default', async () => {
    const path = uniquePath('post');
    server.route(path, (_request, response) => {
      response.writeHead(503).end();
    });

    const { error } = await request(`${server.origin}${path}`, {
      method: 'POST',
      body: { a: 1 },
      retryDelaysSeconds: [0, 0],
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', attempts: 1 });
    expect(server.requests(path)).toHaveLength(1);
  });

  test('never retries a status NON_RETRYABLE_STATUS_CODES lists, nor a listed API code', async () => {
    const notFound = uniquePath('not-found');
    const quota = uniquePath('quota');
    server.route(notFound, (_request, response) => {
      response.writeHead(404).end();
    });
    server.route(quota, (_request, response) => {
      sendJson(response, 503, {
        success: false,
        error: { code: 'QUOTA', message: 'Quota exceeded.', data: null },
      });
    });

    const first = await request(`${server.origin}${notFound}`, {
      retryDelaysSeconds: [0],
      retryStatusCodes: [404],
    });
    const second = await request(`${server.origin}${quota}`, {
      parseAs: 'envelope',
      retryDelaysSeconds: [0],
      nonRetryableErrorCodes: ['QUOTA'],
    });

    expect(first.error).toMatchObject({ kind: 'HTTP_ERROR', status: 404, attempts: 1 });
    expect(second.error).toMatchObject({ kind: 'API_ERROR', code: 'QUOTA', attempts: 1 });
  });

  test('retries a 429 only with Retry-After, waiting for it', async () => {
    const withHeader = uniquePath('rate-limited');
    const withoutHeader = uniquePath('rate-limited-bare');
    server.route(withHeader, (_request, response, attempt) => {
      if (attempt === 1) {
        response.writeHead(429, { 'Retry-After': '1' }).end();
        return;
      }
      sendJson(response, 200, { ok: true });
    });
    server.route(withoutHeader, (_request, response) => {
      response.writeHead(429).end();
    });

    const retried = await request(`${server.origin}${withHeader}`, { retryDelaysSeconds: [0] });
    const stopped = await request(`${server.origin}${withoutHeader}`, { retryDelaysSeconds: [0] });

    expect(retried.data).toStrictEqual({ ok: true });
    expect(retried.meta.attempts).toBe(2);
    expect(retried.meta.durationMs).toBeGreaterThanOrEqual(950);
    expect(stopped.error).toMatchObject({ kind: 'HTTP_ERROR', status: 429, attempts: 1 });
  });

  test('stops and reports Retry-After when it exceeds the cap or the time left', async () => {
    const path = uniquePath('rate-limited-long');
    server.route(path, (_request, response) => {
      response.writeHead(429, { 'Retry-After': '20' }).end();
    });

    const capped = await request(`${server.origin}${path}`, {
      retryDelaysSeconds: [0],
      maxRetryAfterSeconds: 10,
    });
    const tooLate = await request(`${server.origin}${path}`, {
      retryDelaysSeconds: [0],
      timeoutSeconds: 5,
    });

    expect(capped.error).toMatchObject({ kind: 'HTTP_ERROR', retryAfterMs: 20_000, attempts: 1 });
    expect(tooLate.error).toMatchObject({ kind: 'HTTP_ERROR', retryAfterMs: 20_000, attempts: 1 });
    expect(capped.meta.durationMs).toBeLessThan(5_000);
  });

  test('never retries a stream body, which can be sent once', async () => {
    const path = uniquePath('stream');
    server.route(path, (request, response) => {
      response.writeHead(503).end(request.body);
    });
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode('streamed'));
        controller.close();
      },
    });

    const { error } = await request(`${server.origin}${path}`, {
      method: 'POST',
      body,
      parseAs: 'text',
      retryMethods: ['POST'],
      retryDelaysSeconds: [0, 0],
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', status: 503, attempts: 1, body: 'streamed' });
    expect(server.requests(path)).toHaveLength(1);
  });

  test('retries a network error', async () => {
    const closed = await startTestServer();
    const { origin } = closed;
    await closed.close();

    const { error } = await request(`${origin}/gone`, { retryDelaysSeconds: [0, 0] });

    expect(error).toMatchObject({ kind: 'NETWORK_ERROR', status: null, attempts: 3 });
    expect(error?.cause).toBeInstanceOf(TypeError);
  });
});

describe('timeouts and aborts', () => {
  test('stops the whole call at timeoutSeconds with TIMEOUT', async () => {
    const path = uniquePath('slow');
    server.route(path, async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      response.writeHead(200).end('{}');
    });

    const { error, meta } = await request(`${server.origin}${path}`, { timeoutSeconds: 0.2 });

    expect(error).toMatchObject({ kind: 'TIMEOUT', status: null, attempts: 1 });
    expect(meta.durationMs).toBeLessThan(900);
  });

  test('retries an attempt that runs out of attemptTimeoutSeconds', async () => {
    const path = uniquePath('slow-once');
    server.route(path, async (_request, response, attempt) => {
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      sendJson(response, 200, { attempt });
    });

    const { data, meta } = await request(`${server.origin}${path}`, {
      attemptTimeoutSeconds: 0.2,
      retryDelaysSeconds: [0],
    });

    expect(data).toStrictEqual({ attempt: 2 });
    expect(meta.attempts).toBe(2);
  });

  test('reports the caller aborting as ABORTED, also while waiting to retry', async () => {
    const slow = uniquePath('abort-slow');
    const busy = uniquePath('abort-busy');
    server.route(slow, async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      response.writeHead(200).end('{}');
    });
    server.route(busy, (_request, response) => {
      response.writeHead(503).end();
    });

    const during = new AbortController();
    setTimeout(() => during.abort(), 100);
    const waiting = new AbortController();
    setTimeout(() => waiting.abort(), 300);
    const [first, second] = await Promise.all([
      request(`${server.origin}${slow}`, { signal: during.signal }),
      request(`${server.origin}${busy}`, { signal: waiting.signal, retryDelaysSeconds: [5] }),
    ]);

    expect(first.error).toMatchObject({ kind: 'ABORTED', attempts: 1 });
    expect(second.error).toMatchObject({ kind: 'ABORTED', attempts: 1 });
    expect(second.meta.durationMs).toBeLessThan(2_000);
  });

  test('reports a caller signal that times out as TIMEOUT', async () => {
    const path = uniquePath('caller-timeout');
    server.route(path, async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      response.writeHead(200).end('{}');
    });

    const { error } = await request(`${server.origin}${path}`, {
      signal: AbortSignal.timeout(100),
    });

    expect(error).toMatchObject({ kind: 'TIMEOUT' });
  });
});

describe('headers callbacks that never settle', () => {
  // a headers callback whose promise never settles, such as a token refresh that hangs
  const neverSettles = (): Promise<Record<string, string>> => new Promise(() => undefined);

  test('the whole call ends at timeoutSeconds with TIMEOUT, without sending anything', async () => {
    const path = uniquePath('headers-hang');
    server.route(path, (_request, response) => {
      sendJson(response, 200, { ok: true });
    });

    const { data, error, meta } = await request(`${server.origin}${path}`, {
      timeoutSeconds: 0.05,
      headers: neverSettles,
    });

    expect(data).toBeNull();
    expect(error).toMatchObject({ kind: 'TIMEOUT', attempts: 1 });
    expect(meta.durationMs).toBeLessThan(1_000);
    expect(server.requests(path)).toHaveLength(0);
  });

  test('the attempt ends at attemptTimeoutSeconds, and the next attempt goes ahead', async () => {
    const path = uniquePath('headers-hang-once');
    server.route(path, (request, response) => {
      sendJson(response, 200, { token: request.headers['authorization'] });
    });

    const { data, error, meta } = await request(`${server.origin}${path}`, {
      attemptTimeoutSeconds: 0.05,
      retryDelaysSeconds: [0],
      headers: ({ attempt }) =>
        attempt === 1 ? neverSettles() : { authorization: `Bearer token-${attempt}` },
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ token: 'Bearer token-2' });
    expect(meta.attempts).toBe(2);
    expect(server.requests(path)).toHaveLength(1);
  });

  test('a Node.js process with nothing else to do stays alive until the timeout', async () => {
    // the built package, which `test:integration` builds first
    const entry = pathToFileURL(join(import.meta.dirname, '..', '..', 'dist', 'index.js')).href;
    const script = [
      `import { request } from ${JSON.stringify(entry)};`,
      "const { error } = await request('http://127.0.0.1:9/', {",
      '  timeoutSeconds: 0.05,',
      '  headers: () => new Promise(() => undefined),',
      '});',
      'process.stdout.write(error.kind);',
    ].join('\n');

    const { stdout } = await promisify(execFile)(
      process.execPath,
      ['--input-type=module', '--eval', script],
      { timeout: 10_000 },
    );

    expect(stdout).toBe('TIMEOUT');
  });

  test("the caller's abort ends the call as ABORTED", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 50);

    const { error, meta } = await request(`${server.origin}${uniquePath('headers-abort')}`, {
      signal: controller.signal,
      headers: neverSettles,
    });

    expect(error).toMatchObject({ kind: 'ABORTED', attempts: 1 });
    expect(meta.durationMs).toBeLessThan(1_000);
  });

  test('a callback that rejects after the abort changes nothing', async () => {
    const { error } = await request(`${server.origin}${uniquePath('headers-late')}`, {
      timeoutSeconds: 0.05,
      headers: () =>
        new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('too late')), 150);
        }),
    });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(error).toMatchObject({ kind: 'TIMEOUT' });
  });

  test('a callback that rejects while the signal is already aborted leaves nothing unhandled', async () => {
    // an unhandled rejection fails the run, and crashes a Node.js process by default
    const { error } = await request(`${server.origin}${uniquePath('headers-aborted')}`, {
      signal: AbortSignal.abort(new Error('stopped')),
      headers: () => Promise.reject(new Error('no token')),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toMatchObject({ kind: 'ABORTED' });
  });

  test('a callback that rejects in time is still INVALID_HEADERS', async () => {
    const cause = new Error('no token');

    const { error } = await request(`${server.origin}${uniquePath('headers-reject')}`, {
      headers: () => Promise.reject(cause),
    });

    expect(error).toMatchObject({ kind: 'INVALID_HEADERS', cause });
  });
});

describe('fractional timeouts', () => {
  test.each([
    ['timeoutSeconds', { timeoutSeconds: 0.0015 }],
    ['attemptTimeoutSeconds', { attemptTimeoutSeconds: 0.0015, retryDelaysSeconds: [] }],
    ['both', { timeoutSeconds: 0.0015, attemptTimeoutSeconds: 0.0015 }],
  ])('%s of 0.0015 resolves with a result instead of rejecting', async (_, options) => {
    const path = uniquePath('fractional');
    server.route(path, async (_request, response) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      sendJson(response, 200, { ok: true });
    });

    const result = await request(`${server.origin}${path}`, options);

    expect(result.error).toMatchObject({ kind: 'TIMEOUT' });
    expect(result.data).toBeNull();
  });
});

describe('response size', () => {
  test('stops reading past maxResponseBytes, with and without a Content-Length', async () => {
    const declared = uniquePath('large-declared');
    const streamed = uniquePath('large-streamed');
    server.route(declared, (_request, response) => {
      response.writeHead(200, { 'Content-Length': '2048' }).end('x'.repeat(2048));
    });
    server.route(streamed, (_request, response) => {
      response.writeHead(200);
      response.write('x'.repeat(600));
      response.end('x'.repeat(600));
    });

    const first = await request(`${server.origin}${declared}`, {
      parseAs: 'text',
      maxResponseBytes: 1024,
    });
    const second = await request(`${server.origin}${streamed}`, {
      parseAs: 'text',
      maxResponseBytes: 1024,
    });
    const fits = await request(`${server.origin}${streamed}`, {
      parseAs: 'text',
      maxResponseBytes: 1200,
    });

    expect(first.error).toMatchObject({ kind: 'RESPONSE_TOO_LARGE', status: 200 });
    expect(second.error).toMatchObject({ kind: 'RESPONSE_TOO_LARGE', status: 200 });
    expect(fits.data).toHaveLength(1200);
  });
});

describe('error messages', () => {
  test('leave out the URL and the body', async () => {
    const path = uniquePath('secret');
    server.route(path, (_request, response) => {
      response.writeHead(500, { 'Content-Type': 'text/plain' }).end('internal detail');
    });

    const { error, meta } = await request(`${server.origin}${path}?key=secret-token#frag`, {
      method: 'POST',
      body: { password: 'hunter2' },
    });

    expect(error?.message).toBe('The server returned an unsuccessful status: 500.');
    expect(error?.url).toBe(`${server.origin}${path}`);
    expect(meta.url).toBe(`${server.origin}${path}`);
    expect(error?.body).toBe('internal detail');
    for (const serialized of [String(error), JSON.stringify(error)]) {
      expect(serialized).not.toContain('secret-token');
      expect(serialized).not.toContain('hunter2');
    }
  });
});

describe('credential refresh', () => {
  /**
   * Answers 401 until the request carries the fresh token, then 200 with the token it saw.
   * @param path The route's path.
   * @param freshToken The token the route accepts.
   */
  const routeRequiringToken = (path: string, freshToken: string): void => {
    server.route(path, (request, response) => {
      const authorization = request.headers['authorization'];
      if (authorization === `Bearer ${freshToken}`) {
        sendJson(response, 200, { authorization });
        return;
      }
      sendJson(response, 401, { error: 'unauthorized' });
    });
  };

  test('refreshes after a 401 and repeats at once, sending the new token', async () => {
    const path = uniquePath('refresh-ok');
    routeRequiringToken(path, 'fresh');
    let token = 'expired';
    const refreshCredentials = vi.fn(() => {
      token = 'fresh';
      return true;
    });

    const { data, error, meta } = await request(`${server.origin}${path}`, {
      headers: () => ({ authorization: `Bearer ${token}` }),
      refreshCredentials,
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ authorization: 'Bearer fresh' });
    expect(meta.attempts).toBe(2);
    // the default retry schedule waits 3 seconds, which a refresh never does
    expect(meta.durationMs).toBeLessThan(2_000);
    expect(refreshCredentials).toHaveBeenCalledExactlyOnceWith({
      status: 401,
      code: 'HTTP_ERROR',
      refreshes: 0,
      signal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(
      server.requests(path).map((received) => received.headers['authorization']),
    ).toStrictEqual(['Bearer expired', 'Bearer fresh']);
  });

  test('returns the original failure when the hook declines, or answers anything but true', async () => {
    const path = uniquePath('refresh-declined');
    routeRequiringToken(path, 'fresh');

    const declined = await request(`${server.origin}${path}`, { refreshCredentials: () => false });
    const unclear = await request(`${server.origin}${path}`, {
      refreshCredentials: () => 'yes' as unknown as boolean,
    });

    expect(declined.error).toMatchObject({ kind: 'HTTP_ERROR', status: 401, attempts: 1 });
    expect(unclear.error).toMatchObject({ kind: 'HTTP_ERROR', status: 401, attempts: 1 });
  });

  test('refreshes at most maxCredentialRefreshes times', async () => {
    const path = uniquePath('refresh-max');
    routeRequiringToken(path, 'never-issued');
    const refreshCredentials = vi.fn(() => true);

    const once = await request(`${server.origin}${path}`, { refreshCredentials });
    expect(once.error).toMatchObject({ kind: 'HTTP_ERROR', status: 401, attempts: 2 });
    expect(refreshCredentials).toHaveBeenCalledOnce();

    refreshCredentials.mockClear();
    const none = await request(`${server.origin}${path}`, {
      refreshCredentials,
      maxCredentialRefreshes: 0,
    });
    expect(none.error).toMatchObject({ status: 401, attempts: 1 });
    expect(refreshCredentials).not.toHaveBeenCalled();
  });

  test("refreshes twice for two credentials, each reported by the envelope's code", async () => {
    const path = uniquePath('refresh-two');
    let appCheckToken = 'expired';
    let idToken = 'expired';
    server.route(path, (request, response) => {
      if (request.headers['x-app-check'] !== 'fresh') {
        sendJson(response, 401, {
          success: false,
          error: { code: 'APP_CHECK_INVALID', message: 'App Check failed.', data: null },
        });
        return;
      }
      if (request.headers['authorization'] !== 'Bearer fresh') {
        sendJson(response, 401, {
          success: false,
          error: { code: 'ID_TOKEN_EXPIRED', message: 'The session expired.', data: null },
        });
        return;
      }
      sendJson(response, 200, { success: true, data: { ok: true } });
    });
    const codes: string[] = [];

    const { data, error, meta } = await request(`${server.origin}${path}`, {
      parseAs: 'envelope',
      maxCredentialRefreshes: 2,
      headers: () => ({ 'x-app-check': appCheckToken, authorization: `Bearer ${idToken}` }),
      refreshCredentials: ({ code, refreshes }) => {
        codes.push(`${code}:${refreshes}`);
        if (code === 'APP_CHECK_INVALID') {
          appCheckToken = 'fresh';
        } else {
          idToken = 'fresh';
        }
        return Promise.resolve(true);
      },
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ ok: true });
    expect(codes).toStrictEqual(['APP_CHECK_INVALID:0', 'ID_TOKEN_EXPIRED:1']);
    expect(meta.attempts).toBe(3);
  });

  test('ends with CREDENTIALS_REFRESH_FAILED, keeping the cause and the status, when the hook throws', async () => {
    const path = uniquePath('refresh-throws');
    routeRequiringToken(path, 'fresh');
    const failure = new Error('The refresh token was revoked.');

    const { error } = await request(`${server.origin}${path}`, {
      refreshCredentials: () => {
        throw failure;
      },
    });

    expect(error).toBeInstanceOf(FetchException);
    expect(error).toMatchObject({
      kind: 'CREDENTIALS_REFRESH_FAILED',
      code: 'CREDENTIALS_REFRESH_FAILED',
      message: ERROR_MESSAGES.CREDENTIALS_REFRESH_FAILED,
      status: 401,
      data: { code: 'HTTP_ERROR' },
      attempts: 1,
    });
    expect(error?.cause).toBe(failure);
  });

  test("keeps the envelope's code in the data when a rejected refresh follows an API error", async () => {
    const path = uniquePath('refresh-rejects');
    server.route(path, (_request, response) => {
      sendJson(response, 401, {
        success: false,
        error: { code: 'ID_TOKEN_EXPIRED', message: 'The session expired.', data: null },
      });
    });

    const { error } = await request(`${server.origin}${path}`, {
      parseAs: 'envelope',
      refreshCredentials: () => Promise.reject(new Error('offline')),
    });

    expect(error).toMatchObject({
      kind: 'CREDENTIALS_REFRESH_FAILED',
      status: 401,
      data: { code: 'ID_TOKEN_EXPIRED' },
    });
  });

  test('ends with TIMEOUT when the hook outlives the call, and ABORTED when the caller aborts it', async () => {
    const path = uniquePath('refresh-hangs');
    routeRequiringToken(path, 'fresh');
    const controller = new AbortController();

    const timedOut = await request(`${server.origin}${path}`, {
      timeoutSeconds: 0.2,
      refreshCredentials: () => new Promise<boolean>(() => undefined),
    });
    const aborted = await request(`${server.origin}${path}`, {
      signal: controller.signal,
      refreshCredentials: ({ signal }) => {
        controller.abort();
        return new Promise<boolean>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('stopped')));
        });
      },
    });

    expect(timedOut.error).toMatchObject({ kind: 'TIMEOUT', attempts: 1 });
    expect(timedOut.meta.durationMs).toBeLessThan(1_500);
    expect(aborted.error).toMatchObject({ kind: 'ABORTED', attempts: 1 });
  });

  test('keeps the whole retry schedule for a retryable failure after a refresh', async () => {
    const path = uniquePath('refresh-then-retry');
    server.route(path, (_request, response, attempt) => {
      if (attempt === 1) {
        sendJson(response, 401, {});
      } else if (attempt <= 3) {
        response.writeHead(503).end();
      } else {
        sendJson(response, 200, { ok: true });
      }
    });

    const { data, error, meta } = await request(`${server.origin}${path}`, {
      retryDelaysSeconds: [0, 0],
      refreshCredentials: () => true,
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ ok: true });
    expect(meta.attempts).toBe(4);
  });

  test('repeats a POST after a refresh, but never retries its other failures', async () => {
    const refreshedPath = uniquePath('refresh-post');
    routeRequiringToken(refreshedPath, 'fresh');
    const failingPath = uniquePath('refresh-post-500');
    server.route(failingPath, (_request, response) => {
      response.writeHead(500).end();
    });
    let token = 'expired';

    const refreshed = await request(`${server.origin}${refreshedPath}`, {
      method: 'POST',
      body: { name: 'Ada' },
      headers: () => ({ authorization: `Bearer ${token}` }),
      refreshCredentials: () => {
        token = 'fresh';
        return true;
      },
    });
    const failing = await request(`${server.origin}${failingPath}`, {
      method: 'POST',
      body: { name: 'Ada' },
      retryDelaysSeconds: [0, 0],
      refreshCredentials: () => false,
    });

    expect(refreshed.error).toBeNull();
    expect(refreshed.meta.attempts).toBe(2);
    expect(failing.error).toMatchObject({ kind: 'HTTP_ERROR', status: 500, attempts: 1 });
    expect(server.requests(failingPath)).toHaveLength(1);
  });

  test("never asks the hook for a streamed body, which can't be sent again", async () => {
    // a 403, because Node.js's fetch turns a 401 to a streamed body into a network error, as the
    // Fetch standard asks
    const path = uniquePath('refresh-stream');
    server.route(path, (_request, response) => {
      sendJson(response, 403, { error: 'forbidden' });
    });
    const refreshCredentials = vi.fn(() => true);
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => {
        controller.enqueue(new TextEncoder().encode('streamed'));
        controller.close();
      },
    });

    const { error } = await request(`${server.origin}${path}`, {
      method: 'POST',
      body,
      refreshCredentials,
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', status: 403, attempts: 1 });
    expect(refreshCredentials).not.toHaveBeenCalled();
  });

  test('never asks the hook without a failed response, such as for a network error or a body that is not JSON', async () => {
    const closed = await startTestServer();
    const { origin } = closed;
    await closed.close();
    const textPath = uniquePath('refresh-parse');
    server.route(textPath, (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' }).end('not json');
    });
    const refreshCredentials = vi.fn(() => true);

    const network = await request(`${origin}/gone`, { retryDelaysSeconds: [], refreshCredentials });
    const parse = await request(`${server.origin}${textPath}`, { refreshCredentials });

    expect(network.error).toMatchObject({ kind: 'NETWORK_ERROR' });
    expect(parse.error).toMatchObject({ kind: 'PARSE_ERROR', status: 200 });
    expect(refreshCredentials).not.toHaveBeenCalled();
  });
});
