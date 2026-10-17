import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ERRORS, MAX_TIMEOUT_SECONDS } from '../shared/index.js';
import type { IRequestOptions, IRequestResult } from '../shared/index.js';
import { request } from './request.js';
import { sendJson, startTestServer, type ITestServer } from './server.test-utils.js';

/*
 * Property: request never rejects and never outlives its timeout, whatever options it gets, so a
 * caller never needs a try/catch or a timer of its own. It covers the whole class of the 0.1.1
 * bugs: fractional timeouts that threw, and headers callbacks that held a request forever.
 */

// how long past its timeout a request may settle, for timers and a busy machine
const MARGIN_MS = 1_500;

// the kinds a failed request reports
const KNOWN_KINDS = new Set<string>(Object.values(ERRORS));

// the kinds of a request refused before it reaches the network
const VALIDATION_KINDS = new Set<string>(['INVALID_OPTIONS', 'INVALID_URL', 'INVALID_BODY']);

// the generated cases, each a request against the local server
const NUM_RUNS = 300;

let server: ITestServer;

beforeAll(async () => {
  server = await startTestServer();
  server.route('/ok', (_request, response) => {
    sendJson(response, 200, { id: 1 });
  });
  server.route('/envelope', (_request, response) => {
    sendJson(response, 404, {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found', data: null },
    });
  });
  server.route('/busy', (_request, response) => {
    response.writeHead(503, { 'Retry-After': '0' }).end();
  });
  server.route('/slow', async (_request, response) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    sendJson(response, 200, { slow: true });
  });
  server.route('/text', (_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end('not json');
  });
});

afterAll(async () => {
  await server.close();
});

/**
 * Picks a usual value most of the time, and an odd one sometimes, so most runs reach the network
 * and the rest cover the values that once broke a request.
 * @param usual The usual values.
 * @param odd The odd values.
 * @returns The arbitrary.
 */
const mostly = <T>(usual: fc.Arbitrary<T>, odd: fc.Arbitrary<T>): fc.Arbitrary<T> =>
  fc.oneof({ arbitrary: usual, weight: 19 }, { arbitrary: odd, weight: 1 });

// a numeric option: a small valid value, or one of the values that once broke a request
const seconds = mostly(
  fc.double({ min: 0.001, max: 0.3, noNaN: true }),
  fc.constantFrom(0, -1, 0.0015, Number.NaN, Infinity, -Infinity, MAX_TIMEOUT_SECONDS + 1, 1e12),
);

// a timeout the property can wait for: small and valid, or invalid
const timeoutSeconds = mostly(
  fc.double({ min: 0.001, max: 0.3, noNaN: true }),
  fc.constantFrom(0, -1, Number.NaN, Infinity, MAX_TIMEOUT_SECONDS + 1),
);

// a headers option, including callbacks that throw, reject, or never settle
const headers = fc.constantFrom<IRequestOptions<unknown>['headers'] | 'never' | undefined>(
  undefined,
  undefined,
  undefined,
  { 'x-trace': '1' },
  { 'bad header name': 'x' },
  () => ({ authorization: 'Bearer a' }),
  () => Promise.resolve({ authorization: 'Bearer b' }),
  () => {
    throw new Error('no token');
  },
  () => Promise.reject(new Error('no token')),
  'never',
  'x-token: 1' as unknown as Record<string, string>,
);

// a body, including values JSON can't hold
const circular: Record<string, unknown> = {};
circular['self'] = circular;
const body = fc.constantFrom<unknown>(
  undefined,
  undefined,
  undefined,
  undefined,
  null,
  { id: 1 },
  [1, 2],
  'text',
  42,
  { id: 1n },
  circular,
  Symbol('body'),
  () => 'body',
  new Blob(['blob']),
);

// a query, including values a query can't hold
const query = mostly(
  fc.constantFrom<unknown>(undefined, { page: 2, tags: ['a', 'b'] }, { search: 'a b&c' }),
  fc.constantFrom<unknown>({ nested: { x: 1 } }, { symbol: Symbol('q') }, 'page=2', null),
);

// how the caller's signal behaves
const signal = fc.constantFrom('none', 'none', 'none', 'aborted', 'aborts-soon', 'times-out-soon');

// builds the caller's signal
const buildSignal = (kind: string): AbortSignal | undefined => {
  if (kind === 'aborted') {
    return AbortSignal.abort(new Error('stopped'));
  }
  if (kind === 'aborts-soon') {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    return controller.signal;
  }
  return kind === 'times-out-soon' ? AbortSignal.timeout(20) : undefined;
};

// whether a number is a timeout request accepts
const isValidTimeout = (value: number): boolean =>
  Number.isFinite(value) && value > 0 && value <= MAX_TIMEOUT_SECONDS;

describe('request', () => {
  test('never rejects, and settles within its timeout, for any options', async () => {
    let reachedNetwork = 0;
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          path: fc.constantFrom('/ok', '/envelope', '/busy', '/slow', '/text', '/missing'),
          method: mostly(fc.constantFrom('GET', 'POST', 'HEAD'), fc.constant('TRACE')),
          parseAs: mostly(
            fc.constantFrom('json', 'envelope', 'text', 'bytes', 'none', 'response'),
            fc.constant('xml'),
          ),
          timeoutSeconds,
          attemptTimeoutSeconds: fc.option(seconds, { nil: undefined }),
          retryDelaysSeconds: fc.option(fc.array(seconds, { maxLength: 2 }), { nil: undefined }),
          maxRetryAfterSeconds: fc.option(seconds, { nil: undefined }),
          maxResponseBytes: fc.option(
            mostly(fc.constantFrom(1, 1024), fc.constantFrom(0, -1, 1.5, Number.NaN)),
            { nil: undefined },
          ),
          retryStatusCodes: fc.option(
            mostly<number[]>(fc.constant([503]), fc.constantFrom([600], [-1])),
            {
              nil: undefined,
            },
          ),
          headers,
          body,
          query,
          signal,
          // a body goes with POST, except in the runs that check a GET or HEAD body is refused
          isBodyOnRead: mostly(fc.constant(false), fc.constant(true)),
        }),
        async ({ isBodyOnRead, ...generated }) => {
          const hasBody = generated.body !== undefined;
          const options = {
            ...generated,
            method:
              hasBody && !isBodyOnRead && generated.method !== 'TRACE' ? 'POST' : generated.method,
            headers:
              generated.headers === 'never'
                ? () => new Promise<Record<string, string>>(() => undefined)
                : generated.headers,
            signal: buildSignal(generated.signal),
          } as unknown as IRequestOptions<unknown>;
          const limitMs = isValidTimeout(generated.timeoutSeconds)
            ? generated.timeoutSeconds * 1000
            : 0;
          const startedAt = performance.now();

          const outcome = await Promise.race([
            request(`${server.origin}${generated.path}`, options).then(
              (result: IRequestResult<unknown>) => ({ result }),
              (rejection: unknown) => ({ rejection }),
            ),
            new Promise<{ hung: true }>((resolve) => {
              setTimeout(() => resolve({ hung: true }), limitMs + MARGIN_MS * 2);
            }),
          ]);

          expect(outcome).not.toHaveProperty('rejection');
          expect(outcome).not.toHaveProperty('hung');
          expect(performance.now() - startedAt).toBeLessThan(limitMs + MARGIN_MS);
          if ('result' in outcome && !VALIDATION_KINDS.has(outcome.result.error?.kind ?? '')) {
            reachedNetwork += 1;
          }
          if ('result' in outcome && outcome.result.error !== null) {
            expect(KNOWN_KINDS.has(outcome.result.error.kind)).toBe(true);
            expect(outcome.result.data).toBeNull();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
    // most runs must get past validation, or the property only tests the options' checks
    expect(reachedNetwork).toBeGreaterThan(NUM_RUNS / 4);
  }, 120_000);
});
