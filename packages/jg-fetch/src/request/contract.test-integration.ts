import { buildResponse } from 'jg-api-response';
import { Exception, type IJsonValue, UNKNOWN_ERROR_CODE } from 'jg-exception';
import { afterAll, beforeAll, describe, expect, expectTypeOf, test } from 'vitest';
import { z } from 'zod';

import { FetchException } from '../fetch-exception/index.js';
import { request } from './request.js';
import { sendJson, startTestServer, type ITestServer } from './server.test-utils.js';

/*
 * Contract tests: a server builds its envelopes with the real jg-api-response and jg-exception, and
 * the client reads them with request.
 */

let server: ITestServer;

// a path unique to each test, so their routes never mix
let pathCounter = 0;
const uniquePath = (name: string): string => {
  pathCounter += 1;
  return `/${name}-${pathCounter}`;
};

/**
 * Serves one envelope at a new path, the way a service sends it.
 * @param status The HTTP status.
 * @param envelope The envelope to send.
 * @returns The URL that serves it.
 */
const serve = (status: number, envelope: unknown): string => {
  const path = uniquePath('envelope');
  server.route(path, (_request, response) => {
    sendJson(response, status, envelope);
  });
  return `${server.origin}${path}`;
};

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

describe('errors from jg-api-response envelopes', () => {
  test("an Exception's code, message, and data reach the client", async () => {
    const envelope = buildResponse(
      undefined,
      new Exception('The user was not found.', { code: 'USER_NOT_FOUND', data: { id: 1 } }),
    );

    const { data, error } = await request(serve(404, envelope), { parseAs: 'envelope' });

    expect(data).toBeNull();
    expect(error).toBeInstanceOf(FetchException);
    expect(error).toMatchObject({
      kind: 'API_ERROR',
      code: 'USER_NOT_FOUND',
      message: 'The user was not found.',
      data: { id: 1 },
      status: 404,
    });
    expect(error?.body).toStrictEqual(JSON.parse(JSON.stringify(envelope)));
  });

  test('an Exception in a response with a successful status still fails', async () => {
    const envelope = buildResponse(
      { partial: true },
      new Exception('Some items failed.', { code: 'PARTIAL_FAILURE', data: { failed: [2, 3] } }),
    );

    const { error } = await request(serve(200, envelope), { parseAs: 'envelope' });

    expect(error).toMatchObject({
      kind: 'API_ERROR',
      code: 'PARTIAL_FAILURE',
      message: 'Some items failed.',
      data: { failed: [2, 3] },
      body: { data: { partial: true } },
    });
  });

  test('an error that is not an Exception arrives as UNKNOWN_ERROR with its message', async () => {
    const envelope = buildResponse(undefined, new Error('The database is unavailable.'));

    const { error } = await request(serve(500, envelope), {
      parseAs: 'envelope',
      retryDelaysSeconds: [],
    });

    expect(error).toMatchObject({
      kind: 'API_ERROR',
      code: UNKNOWN_ERROR_CODE,
      message: 'The database is unavailable.',
      data: null,
    });
  });

  test("another error's string code reaches the client", async () => {
    const envelope = buildResponse(
      undefined,
      Object.assign(new Error('The file is missing.'), { code: 'ENOENT' }),
    );

    const { error } = await request(serve(500, envelope), {
      parseAs: 'envelope',
      retryDelaysSeconds: [],
    });

    expect(error).toMatchObject({ code: 'ENOENT', message: 'The file is missing.', data: null });
  });

  test('Exception data that cannot be serialized arrives as null', async () => {
    const data: Record<string, unknown> = { id: 1 };
    data['self'] = data;
    const envelope = buildResponse(
      undefined,
      new Exception('Failed.', { code: 'FAILED', data: data as unknown as IJsonValue }),
    );

    const { error } = await request(serve(400, envelope), { parseAs: 'envelope' });

    expect(error).toMatchObject({ code: 'FAILED', message: 'Failed.', data: null });
  });

  test("an API error's code decides whether it retries", async () => {
    const path = uniquePath('quota');
    server.route(path, (_request, response) => {
      sendJson(
        response,
        503,
        buildResponse(undefined, new Exception('Quota exceeded.', { code: 'QUOTA' })),
      );
    });

    const { error } = await request(`${server.origin}${path}`, {
      parseAs: 'envelope',
      retryDelaysSeconds: [0],
      nonRetryableErrorCodes: ['QUOTA'],
    });

    expect(error).toMatchObject({ code: 'QUOTA', attempts: 1 });
    expect(server.requests(path)).toHaveLength(1);
  });
});

describe('data from jg-api-response envelopes', () => {
  const User = z.object({ id: z.number(), name: z.string() });

  test('a success envelope resolves to its data, validated by a Zod schema', async () => {
    const { data, error } = await request(serve(200, buildResponse({ id: 1, name: 'Ada' })), {
      parseAs: 'envelope',
      schema: User,
    });

    expect(error).toBeNull();
    expect(data).toStrictEqual({ id: 1, name: 'Ada' });
    expectTypeOf(data).toEqualTypeOf<{ id: number; name: string } | null>();
  });

  test("data that fails the Zod schema is RESPONSE_INVALID, with the schema's error as cause", async () => {
    const { data, error } = await request(serve(200, buildResponse({ id: '1', name: 'Ada' })), {
      parseAs: 'envelope',
      schema: User,
    });

    expect(data).toBeNull();
    expect(error).toMatchObject({ kind: 'RESPONSE_INVALID', code: 'RESPONSE_INVALID' });
    expect(error?.cause).toBeInstanceOf(z.ZodError);
  });

  test('an envelope without data resolves to undefined', async () => {
    const { data, error } = await request(serve(200, buildResponse()), { parseAs: 'envelope' });

    expect(error).toBeNull();
    expect(data).toBeUndefined();
  });
});
