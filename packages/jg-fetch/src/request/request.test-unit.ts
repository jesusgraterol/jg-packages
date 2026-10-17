import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';

import { FetchException } from '../fetch-exception/index.js';
import type { IRequestResult } from '../shared/index.js';
import { request } from './request.js';

// a URL the stubbed fetch answers for
const URL_WITH_TOKEN = 'https://api.example.com/users?key=secret-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request result types', () => {
  test('narrow the data by parseAs and the schema', () => {
    expectTypeOf(request('x')).toEqualTypeOf<Promise<IRequestResult<unknown>>>();
    expectTypeOf(request<{ id: number }>('x', { parseAs: 'envelope' })).toEqualTypeOf<
      Promise<IRequestResult<{ id: number }>>
    >();
    expectTypeOf(request('x', { parseAs: 'json' })).toEqualTypeOf<
      Promise<IRequestResult<unknown>>
    >();
    expectTypeOf(request('x', { parseAs: 'text' })).toEqualTypeOf<
      Promise<IRequestResult<string>>
    >();
    expectTypeOf(request('x', { parseAs: 'bytes' })).toEqualTypeOf<
      Promise<IRequestResult<Uint8Array>>
    >();
    expectTypeOf(request('x', { parseAs: 'blob' })).toEqualTypeOf<Promise<IRequestResult<Blob>>>();
    expectTypeOf(request('x', { parseAs: 'response' })).toEqualTypeOf<
      Promise<IRequestResult<Response>>
    >();
    expectTypeOf(request('x', { parseAs: 'none' })).toEqualTypeOf<
      Promise<IRequestResult<undefined>>
    >();
    expectTypeOf(
      request('x', { schema: { parse: (value: unknown): number => Number(value) } }),
    ).toEqualTypeOf<Promise<IRequestResult<number>>>();
  });

  test('narrow data and error together', () => {
    const result = {} as IRequestResult<string>;
    if (result.error === null) {
      expectTypeOf(result.data).toEqualTypeOf<string>();
    } else {
      expectTypeOf(result.data).toEqualTypeOf<null>();
      expectTypeOf(result.error).toEqualTypeOf<FetchException>();
    }
  });
});

describe('request', () => {
  test('never throws for invalid options, URLs, bodies, or headers', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const results = await Promise.all([
      request(URL_WITH_TOKEN, { timeoutSeconds: -1 }),
      request('/relative'),
      request(URL_WITH_TOKEN, { method: 'POST', body: { id: 1n } }),
      request(URL_WITH_TOKEN, {
        headers: () => {
          throw new Error('The token could not be refreshed.');
        },
      }),
      request(URL_WITH_TOKEN, { headers: { 'bad header': 'x' } }),
    ]);

    expect(results.map(({ error }) => error?.kind)).toStrictEqual([
      'INVALID_OPTIONS',
      'INVALID_URL',
      'INVALID_BODY',
      'INVALID_HEADERS',
      'INVALID_HEADERS',
    ]);
    for (const { data, error, meta } of results) {
      expect(data).toBeNull();
      expect(error).toBeInstanceOf(FetchException);
      expect(error?.message).not.toContain('secret-token');
      expect(meta.url).not.toContain('secret-token');
      expect(meta.status).toBeNull();
    }
    expect(results[3]?.error?.cause).toStrictEqual(new Error('The token could not be refreshed.'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('keeps retrying when onRetry throws', async () => {
    const fetchSpy = vi
      .fn<(request: Request) => Promise<Response>>()
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ id: 1 }));
    vi.stubGlobal('fetch', fetchSpy);
    const onRetry = vi.fn(() => {
      throw new Error('The logger is down.');
    });

    const result = await request(URL_WITH_TOKEN, { retryDelaysSeconds: [0], onRetry });

    expect(result.data).toStrictEqual({ id: 1 });
    expect(result.meta.attempts).toBe(2);
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 0,
      error: expect.objectContaining({ kind: 'HTTP_ERROR', status: 503 }) as unknown,
    });
    // each attempt sends a fresh Request
    expect(fetchSpy.mock.calls[0]?.[0]).not.toBe(fetchSpy.mock.calls[1]?.[0]);
  });

  test('reports an abort before the call starts as ABORTED, and a timeout reason as TIMEOUT', async () => {
    vi.stubGlobal('fetch', (input: Request) =>
      Promise.reject(
        input.signal.reason instanceof Error ? input.signal.reason : new Error('aborted'),
      ),
    );

    const aborted = await request(URL_WITH_TOKEN, { signal: AbortSignal.abort() });
    const timedOut = await request(URL_WITH_TOKEN, {
      signal: AbortSignal.abort(new DOMException('Too slow.', 'TimeoutError')),
    });

    expect(aborted.error?.kind).toBe('ABORTED');
    expect(timedOut.error?.kind).toBe('TIMEOUT');
    expect(aborted.meta.attempts).toBe(1);
  });

  test('reports an option it fails to read as INVALID_OPTIONS, with the error as the cause', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const cause = new Error('a getter that throws');
    const options = {
      get method(): never {
        throw cause;
      },
    };

    const { error } = await request(URL_WITH_TOKEN, options);

    expect(error).toMatchObject({ kind: 'INVALID_OPTIONS', cause });
  });

  test('reads a response without a body as empty bytes', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 200 })));

    const { data, error } = await request(URL_WITH_TOKEN, { parseAs: 'bytes' });

    expect(error).toBeNull();
    expect(data).toStrictEqual(new Uint8Array(0));
  });

  test('gives a blob the response content type, or none', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response(new Uint8Array([1, 2]), { status: 200 })),
    );

    const { data } = await request(URL_WITH_TOKEN, { parseAs: 'blob' });

    expect(data?.type).toBe('');
    expect(data?.size).toBe(2);
  });

  test('reports an error body that breaks while it streams as NETWORK_ERROR, not HTTP_ERROR', async () => {
    const cause = new TypeError('The connection was reset.');
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(cause);
            },
          }),
          { status: 500 },
        ),
      ),
    );

    const { error } = await request(URL_WITH_TOKEN, { retryDelaysSeconds: [] });

    expect(error).toMatchObject({ kind: 'NETWORK_ERROR', cause });
  });

  test('reports an unread error response whose body breaks as NETWORK_ERROR', async () => {
    const cause = new TypeError('The connection was reset.');
    vi.stubGlobal('fetch', () =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(cause);
            },
          }),
          { status: 500 },
        ),
      ),
    );

    const { error } = await request(URL_WITH_TOKEN, { parseAs: 'none', retryDelaysSeconds: [] });

    expect(error).toMatchObject({ kind: 'NETWORK_ERROR', cause });
  });

  test('reports a successful response that is not JSON as PARSE_ERROR, with its text', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('not json', { status: 200 })));

    const { error } = await request(URL_WITH_TOKEN);

    expect(error).toMatchObject({ kind: 'PARSE_ERROR', body: 'not json' });
    expect(error?.cause).toBeInstanceOf(SyntaxError);
  });

  test('leaves out an unread error body too large to read, and reports the status', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('x'.repeat(100), { status: 500 })));

    const { error } = await request(URL_WITH_TOKEN, {
      parseAs: 'none',
      maxResponseBytes: 10,
      retryDelaysSeconds: [],
    });

    expect(error).toMatchObject({ kind: 'HTTP_ERROR', status: 500, body: undefined });
  });

  test('reads a status without a body as empty bytes, without reading', async () => {
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 204 })));

    const { data, error } = await request(URL_WITH_TOKEN, { parseAs: 'bytes' });

    expect(error).toBeNull();
    expect(data).toStrictEqual(new Uint8Array(0));
  });
});
