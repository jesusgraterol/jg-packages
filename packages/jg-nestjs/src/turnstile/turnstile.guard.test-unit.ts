import type { ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { TURNSTILE_GUARD_OPTIONS, TURNSTILE_TOKEN_HEADER } from './constants.js';
import { TurnstileGuard } from './turnstile.guard.js';

let module: TestingModule;
let guard: TurnstileGuard;

beforeAll(async () => {
  module = await Test.createTestingModule({
    providers: [
      TurnstileGuard,
      {
        provide: TURNSTILE_GUARD_OPTIONS,
        useValue: { secretKey: 'secret-key', allowedHostnames: ['app.example.com'] },
      },
    ],
  }).compile();
  await module.init();
  guard = module.get(TurnstileGuard);
});

afterAll(async () => {
  await module.close();
});

// an HTTP request's context, carrying a Turnstile token
const httpContext = (token: string): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ headers: { [TURNSTILE_TOKEN_HEADER]: token } }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  }) as unknown as ExecutionContext;

describe('TurnstileGuard', () => {
  test('lets other contexts, such as microservices, through without calling siteverify', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      guard.canActivate({ getType: () => 'rpc' } as unknown as ExecutionContext),
    ).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  test('keeps the error codes siteverify refused a token with as the cause, which clients never see', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] })),
      );

    const error = await guard
      .canActivate(httpContext('token-1'))
      .catch((failure: unknown) => failure);
    fetchSpy.mockRestore();

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: ERRORS.TURNSTILE_FAILED,
      status: 403,
      cause: { code: ERRORS.TURNSTILE_FAILED, data: { errorCodes: ['timeout-or-duplicate'] } },
    });
    expect((error as ApiException).toJSON()).toStrictEqual({
      name: 'ApiException',
      code: ERRORS.TURNSTILE_FAILED,
      message: ERROR_MESSAGES.TURNSTILE_FAILED,
      data: null,
    });
  });
});
