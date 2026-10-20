import type { ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { TURNSTILE_GUARD_OPTIONS } from './constants.js';
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

describe('TurnstileGuard', () => {
  test('lets other contexts, such as microservices, through without calling siteverify', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      guard.canActivate({ getType: () => 'rpc' } as unknown as ExecutionContext),
    ).resolves.toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
