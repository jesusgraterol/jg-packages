import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';
import { describe, expect, test } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { createCorsOptions } from './cors.js';

/**
 * Asks the options' origin callback about one request origin.
 * @param options The CORS options.
 * @param origin The request's Origin header, or undefined without one.
 * @returns The error it refused with, or true when it allowed the origin.
 */
const decide = (options: CorsOptions, origin: string | undefined): unknown => {
  let decision: unknown;
  if (typeof options.origin !== 'function') {
    throw new Error('Expected an origin callback.');
  }
  options.origin(origin, (error, allowed) => {
    decision = error ?? allowed;
  });
  return decision;
};

describe('createCorsOptions', () => {
  test("answers with Moldea's methods and preflight settings, without credentials by default", () => {
    expect(createCorsOptions({ origins: ['https://app.example.com'] })).toMatchObject({
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: false,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });
    expect(
      createCorsOptions({ origins: ['https://app.example.com'], credentials: true }).credentials,
    ).toBe(true);
  });

  test.each([
    ['https://example.com', true],
    ['https://www.example.com', true],
    ['https://admin.example.com:8443', true],
    ['https://www.admin.example.com:8443', true],
    ['https://admin.example.com', false],
    ['http://example.com', false],
    ['https://example.com.evil.test', false],
    ['null', false],
  ])('with www variants, decides %s -> %s', (origin, isAllowed) => {
    const options = createCorsOptions({
      origins: ['https://www.example.com/', 'https://admin.example.com:8443'],
    });

    expect(decide(options, origin) === true).toBe(isAllowed);
  });

  test('allows only the exact origins without www variants', () => {
    const options = createCorsOptions({
      origins: ['https://app.example.com'],
      includeWwwVariants: false,
    });

    expect(decide(options, 'https://app.example.com')).toBe(true);
    expect(decide(options, 'https://www.app.example.com')).toBeInstanceOf(ApiException);
  });

  test.each([
    [undefined, true],
    [true, true],
    [false, false],
  ])(
    'with allowOriginless %s, allows a request without an origin -> %s',
    (allowOriginless, isAllowed) => {
      const options = createCorsOptions({ origins: ['https://app.example.com'], allowOriginless });

      expect(decide(options, undefined) === true).toBe(isAllowed);
    },
  );

  test('refuses another origin with a 403 ApiException', () => {
    const refusal = decide(createCorsOptions({ origins: [] }), 'https://evil.test');

    expect(refusal).toBeInstanceOf(ApiException);
    expect(refusal).toMatchObject({
      code: ERRORS.CORS_ORIGIN_NOT_ALLOWED,
      message: ERROR_MESSAGES.CORS_ORIGIN_NOT_ALLOWED,
      status: 403,
    });
  });

  test("throws when an origin isn't a URL", () => {
    expect(() => createCorsOptions({ origins: ['app.example.com'] })).toThrow(TypeError);
  });
});
