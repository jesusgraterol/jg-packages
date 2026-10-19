import type { ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { IP_BLOCKLIST_GUARD_OPTIONS } from './constants.js';
import { IpBlocklistGuard } from './ip-blocklist.guard.js';
import type { IIpBlocklistGuardOptions, IIpBlocklistRequest } from './types.js';

let module: TestingModule | undefined;

afterEach(async () => {
  await module?.close();
  module = undefined;
});

/**
 * Compiles a module with the guard and its options.
 * @param options The guard's options.
 * @returns A promise that resolves to the guard.
 */
const createGuard = async (options: IIpBlocklistGuardOptions): Promise<IpBlocklistGuard> => {
  module = await Test.createTestingModule({
    providers: [IpBlocklistGuard, { provide: IP_BLOCKLIST_GUARD_OPTIONS, useValue: options }],
  }).compile();
  await module.init();
  return module.get(IpBlocklistGuard);
};

/**
 * Builds a request's context of the given type, holding a request.
 * @param request The request.
 * @param type The context's type.
 * @returns The context.
 */
const createContext = (request: Partial<IIpBlocklistRequest>, type = 'http'): ExecutionContext =>
  ({
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('IpBlocklistGuard', () => {
  test('lets a request through when its normalized address is not blocked', async () => {
    const isBlocked = vi.fn(() => false);
    const guard = await createGuard({ isBlocked });

    await expect(guard.canActivate(createContext({ ip: ' ::FFFF:203.0.113.7' }))).resolves.toBe(
      true,
    );
    expect(isBlocked).toHaveBeenCalledWith('203.0.113.7');
  });

  test.each([
    ['sync', () => true],
    ['async', () => Promise.resolve(true)],
  ])(
    'refuses a blocked address with a 403 IP_BLOCKED and no data, checked %s',
    async (_, isBlocked) => {
      const guard = await createGuard({ isBlocked });

      const error: unknown = await guard
        .canActivate(createContext({ ip: '203.0.113.7' }))
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiException);
      expect(error).toMatchObject({
        code: ERRORS.IP_BLOCKED,
        message: ERROR_MESSAGES.IP_BLOCKED,
        status: 403,
      });
      expect((error as ApiException).data).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain('203.0.113.7');
    },
  );

  test.each([
    ['no address', {}],
    ['an empty address', { ip: '' }],
    ['a blank address', { ip: '  ' }],
  ])('lets a request with %s through without checking it', async (_, request) => {
    const isBlocked = vi.fn(() => true);
    const guard = await createGuard({ isBlocked });

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(isBlocked).not.toHaveBeenCalled();
  });

  test('reads the address with a custom getIp', async () => {
    const isBlocked = vi.fn((ip: string) => ip === '198.51.100.1');
    const getIp = vi.fn((request: IIpBlocklistRequest) => {
      const header = request.headers['cf-connecting-ip'];
      return typeof header === 'string' ? header : undefined;
    });
    const guard = await createGuard({ isBlocked, getIp });
    const request = { ip: '10.0.0.1', headers: { 'cf-connecting-ip': '198.51.100.1' } };

    await expect(guard.canActivate(createContext(request))).rejects.toMatchObject({
      code: ERRORS.IP_BLOCKED,
    });
    expect(getIp).toHaveBeenCalledWith(request);
    expect(isBlocked).toHaveBeenCalledWith('198.51.100.1');
  });

  test('fails closed, passing on the error when the blocklist cannot be read', async () => {
    const failure = new Error('Redis could not complete the blocklist command.');
    const guard = await createGuard({ isBlocked: () => Promise.reject(failure) });

    await expect(guard.canActivate(createContext({ ip: '203.0.113.7' }))).rejects.toBe(failure);
  });

  test('changes nothing on the request, request.user included', async () => {
    const guard = await createGuard({ isBlocked: () => false });
    const user = { id: '42' };
    const request = { ip: '203.0.113.7', user };

    await guard.canActivate(createContext(request));

    expect(request).toStrictEqual({ ip: '203.0.113.7', user: { id: '42' } });
    expect(request.user).toBe(user);
  });

  test('lets other contexts through without checking', async () => {
    const isBlocked = vi.fn(() => true);
    const guard = await createGuard({ isBlocked });

    await expect(guard.canActivate(createContext({ ip: '203.0.113.7' }, 'ws'))).resolves.toBe(true);
    expect(isBlocked).not.toHaveBeenCalled();
  });

  test('fails to compile without its options', async () => {
    await expect(
      Test.createTestingModule({ providers: [IpBlocklistGuard] }).compile(),
    ).rejects.toThrow(/IpBlocklistGuard/);
  });
});
