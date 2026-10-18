import { describe, expect, test } from 'vitest';

import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_RETRY_METHODS,
  DEFAULT_RETRY_STATUS_CODES,
  MAX_TIMEOUT_SECONDS,
  type IRequestOptions,
} from '../shared/index.js';
import { RequestFailure } from './failure.js';
import { buildUrl, resolveOptions, serializeBody, toSafeUrl } from './options.js';

/**
 * Runs a function that should fail and returns the failure.
 * @param run The function.
 * @returns The failure.
 */
const catchFailure = (run: () => unknown): RequestFailure => {
  try {
    run();
  } catch (error) {
    if (error instanceof RequestFailure) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a RequestFailure.');
};

describe('resolveOptions', () => {
  test('applies the defaults, in milliseconds', () => {
    expect(resolveOptions({})).toStrictEqual({
      method: 'GET',
      parseAs: 'json',
      timeoutMs: 15_000,
      attemptTimeoutMs: undefined,
      retryDelaysMs: [3_000, 5_000],
      retryMethods: DEFAULT_RETRY_METHODS,
      retryStatusCodes: DEFAULT_RETRY_STATUS_CODES,
      nonRetryableErrorCodes: [],
      maxRetryAfterMs: 30_000,
      maxResponseBytes: DEFAULT_MAX_RESPONSE_BYTES,
      headers: undefined,
      schema: undefined,
      signal: undefined,
      init: undefined,
      onRetry: undefined,
    });
  });

  test('keeps valid options', () => {
    const signal = new AbortController().signal;
    const resolved = resolveOptions({
      method: 'POST',
      parseAs: 'envelope',
      timeoutSeconds: 120,
      attemptTimeoutSeconds: 0.5,
      retryDelaysSeconds: [0, 1.5],
      retryMethods: ['POST'],
      retryStatusCodes: [503],
      nonRetryableErrorCodes: ['USER_NOT_FOUND'],
      maxRetryAfterSeconds: 0,
      maxResponseBytes: 1,
      signal,
    });

    expect(resolved).toMatchObject({
      method: 'POST',
      parseAs: 'envelope',
      timeoutMs: 120_000,
      attemptTimeoutMs: 500,
      retryDelaysMs: [0, 1_500],
      retryMethods: ['POST'],
      retryStatusCodes: [503],
      nonRetryableErrorCodes: ['USER_NOT_FOUND'],
      maxRetryAfterMs: 0,
      maxResponseBytes: 1,
      signal,
    });
  });

  test.each([
    [0.0015, 2],
    [0.0001, 1],
    [Number.MIN_VALUE, 1],
    [1.0001, 1_001],
    [0.1 + 0.2, 301],
    [MAX_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS * 1000],
  ])('rounds timeouts of %d seconds up to %d whole milliseconds', (seconds, ms) => {
    const resolved = resolveOptions({ timeoutSeconds: seconds, attemptTimeoutSeconds: seconds });

    expect(resolved.timeoutMs).toBe(ms);
    expect(resolved.attemptTimeoutMs).toBe(ms);
    expect(() => AbortSignal.timeout(resolved.timeoutMs)).not.toThrow();
  });

  test('rounds maxRetryAfterSeconds up too, and keeps 0', () => {
    expect(resolveOptions({ maxRetryAfterSeconds: 0.0015 }).maxRetryAfterMs).toBe(2);
    expect(resolveOptions({ maxRetryAfterSeconds: 0 }).maxRetryAfterMs).toBe(0);
  });

  test.each<[string, unknown]>([
    ['the options', null],
    ['method', { method: 'TRACE' }],
    ['parseAs', { parseAs: 'xml' }],
    ['a GET body', { method: 'GET', body: 'text' }],
    ['a HEAD body', { method: 'HEAD', body: { a: 1 } }],
    ['headers', { headers: 'x-token: 1' }],
    ['schema', { schema: { validate: () => true } }],
    ['signal', { signal: { aborted: false } }],
    ['onRetry', { onRetry: 'log' }],
    ['init', { init: 'no-cors' }],
    ['timeoutSeconds 0', { timeoutSeconds: 0 }],
    ['timeoutSeconds NaN', { timeoutSeconds: Number.NaN }],
    ['timeoutSeconds above the maximum', { timeoutSeconds: MAX_TIMEOUT_SECONDS + 1 }],
    ['attemptTimeoutSeconds', { attemptTimeoutSeconds: -1 }],
    ['retryDelaysSeconds', { retryDelaysSeconds: [1, -1] }],
    ['retryDelaysSeconds as a number', { retryDelaysSeconds: 3 }],
    ['retryMethods', { retryMethods: ['GET', 'TRACE'] }],
    ['retryStatusCodes', { retryStatusCodes: [503, 600] }],
    ['nonRetryableErrorCodes', { nonRetryableErrorCodes: [404] }],
    ['maxRetryAfterSeconds', { maxRetryAfterSeconds: Infinity }],
    ['maxResponseBytes 0', { maxResponseBytes: 0 }],
    ['maxResponseBytes 1.5', { maxResponseBytes: 1.5 }],
  ])('rejects invalid %s with INVALID_OPTIONS', (_description, options) => {
    const failure = catchFailure(() => resolveOptions(options as IRequestOptions<unknown>));

    expect(failure.kind).toBe('INVALID_OPTIONS');
    expect(failure.details.message).toMatch(/^The request options are invalid\. /);
  });
});

describe('buildUrl', () => {
  test('resolves an absolute URL and a URL relative to the baseUrl', () => {
    expect(buildUrl('https://api.example.com/users', undefined, undefined).href).toBe(
      'https://api.example.com/users',
    );
    expect(buildUrl('/users/1', 'https://api.example.com/v1/', undefined).href).toBe(
      'https://api.example.com/users/1',
    );
    expect(buildUrl('users/1', new URL('https://api.example.com/v1/'), undefined).href).toBe(
      'https://api.example.com/v1/users/1',
    );
  });

  test.each<[string | URL, string | undefined]>([
    ['/users', undefined],
    ['not a url', undefined],
    ['https://other.example.com/users', 'https://api.example.com'],
    ['//other.example.com/users', 'https://api.example.com'],
    ['ftp://api.example.com/file', undefined],
    ['/users', 'not a base'],
  ])('rejects %j with base %j as INVALID_URL', (url, baseUrl) => {
    expect(catchFailure(() => buildUrl(url, baseUrl, undefined)).kind).toBe('INVALID_URL');
  });

  test('appends the query, skipping empty values and repeating arrays', () => {
    const url = buildUrl('https://api.example.com/search?sort=asc', undefined, {
      q: 'café & tea',
      page: 2,
      exact: true,
      id: 10n,
      tags: ['a', '', null, 'b'],
      empty: '',
      missing: null,
      unset: undefined,
    });

    expect(url.search).toBe('?sort=asc&q=caf%C3%A9+%26+tea&page=2&exact=true&id=10&tags=a&tags=b');
  });

  test.each([
    ['a string', 'page=2'],
    ['null', null],
  ])('rejects a query that is %s, not an object, with INVALID_OPTIONS', (_description, query) => {
    const failure = catchFailure(() =>
      buildUrl('https://api.example.com', undefined, query as unknown as Record<string, string>),
    );

    expect(failure.kind).toBe('INVALID_OPTIONS');
    expect(failure.details.message).toContain('query must be an object.');
  });

  test('rejects a query value that is an object with INVALID_OPTIONS', () => {
    const failure = catchFailure(() =>
      buildUrl('https://api.example.com', undefined, { filter: { a: 1 } as unknown as string }),
    );

    expect(failure.kind).toBe('INVALID_OPTIONS');
    expect(failure.details.message).toContain("The query parameter 'filter'");
  });
});

describe('toSafeUrl', () => {
  test('keeps the origin and path, and drops credentials, the query, and the fragment', () => {
    expect(toSafeUrl('https://user:secret@api.example.com/v1/users?key=token#top')).toBe(
      'https://api.example.com/v1/users',
    );
    expect(toSafeUrl('not a url')).toBe('');
  });
});

describe('serializeBody', () => {
  test('sends plain objects and arrays as JSON', () => {
    expect(serializeBody({ a: 1 })).toStrictEqual({
      value: '{"a":1}',
      isJson: true,
      isStream: false,
    });
    expect(serializeBody([1, 'two'])).toStrictEqual({
      value: '[1,"two"]',
      isJson: true,
      isStream: false,
    });
    expect(serializeBody(Object.assign(Object.create(null) as object, { a: 1 }))).toMatchObject({
      isJson: true,
    });
  });

  test('passes every other body through untouched', () => {
    const formData = new FormData();
    const blob = new Blob(['x']);
    const params = new URLSearchParams({ a: '1' });
    const bytes = new Uint8Array([1, 2]);
    for (const body of [formData, blob, params, bytes, 'text']) {
      expect(serializeBody(body)).toStrictEqual({ value: body, isJson: false, isStream: false });
    }
    expect(serializeBody(undefined)).toStrictEqual({
      value: undefined,
      isJson: false,
      isStream: false,
    });
  });

  test('flags a stream, which never retries', () => {
    const stream = new ReadableStream();

    expect(serializeBody(stream)).toStrictEqual({ value: stream, isJson: false, isStream: true });
  });

  test('reports a body JSON cannot represent as INVALID_BODY', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;

    expect(catchFailure(() => serializeBody({ id: 1n })).kind).toBe('INVALID_BODY');
    expect(catchFailure(() => serializeBody(circular)).kind).toBe('INVALID_BODY');
  });

  test("keeps JSON's error as the cause, out of the message, which can name the body's keys", () => {
    const circular: Record<string, unknown> = { secretKey: 'x' };
    circular['self'] = circular;
    const failure = catchFailure(() => serializeBody(circular));

    expect(failure.details.message).toBeUndefined();
    expect(failure.details.cause).toBeInstanceOf(TypeError);
    expect(failure.message).toBe('INVALID_BODY');
  });
});
