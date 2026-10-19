import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { ApiResponseInterceptor } from './api-response.interceptor.js';

let module: TestingModule;
let interceptor: ApiResponseInterceptor;

beforeAll(async () => {
  module = await Test.createTestingModule({ providers: [ApiResponseInterceptor] }).compile();
  await module.init();
  interceptor = module.get(ApiResponseInterceptor);
});

afterAll(async () => {
  await module.close();
});

/**
 * Builds a context of the given type.
 * @param type The context's type.
 * @returns The context.
 */
const createContext = (type: string): ExecutionContext =>
  ({ getType: () => type }) as unknown as ExecutionContext;

// a handler that returns one project
const next: CallHandler = { handle: () => of({ id: 1 }) };

describe('ApiResponseInterceptor', () => {
  test('wraps an HTTP result in the envelope', async () => {
    await expect(
      firstValueFrom(interceptor.intercept(createContext('http'), next)),
    ).resolves.toStrictEqual({ success: true, data: { id: 1 }, error: null });
  });

  test('leaves the result of another context untouched', async () => {
    await expect(
      firstValueFrom(interceptor.intercept(createContext('rpc'), next)),
    ).resolves.toStrictEqual({ id: 1 });
  });
});
