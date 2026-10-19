import type { ExecutionContext } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { MAINTENANCE_MODE_GUARD_OPTIONS } from './constants.js';
import { MaintenanceModeGuard } from './maintenance-mode.guard.js';
import type { IMaintenanceModeGuardOptions } from './types.js';

let module: TestingModule | undefined;

afterEach(async () => {
  await module?.close();
  module = undefined;
});

/**
 * Compiles a module with the guard and its options.
 * @param getState How the guard reads the state.
 * @returns A promise that resolves to the guard.
 */
const createGuard = async (
  getState: IMaintenanceModeGuardOptions['getState'],
): Promise<MaintenanceModeGuard> => {
  module = await Test.createTestingModule({
    providers: [
      MaintenanceModeGuard,
      { provide: MAINTENANCE_MODE_GUARD_OPTIONS, useValue: { getState } },
    ],
  }).compile();
  await module.init();
  return module.get(MaintenanceModeGuard);
};

/**
 * Builds a request's context of the given type.
 * @param type The context's type.
 * @returns The context.
 */
const createContext = (type = 'http'): ExecutionContext =>
  ({ getType: () => type }) as unknown as ExecutionContext;

describe('MaintenanceModeGuard', () => {
  test.each([
    ['sync', () => ({ enabled: false })],
    ['async', () => Promise.resolve({ enabled: false })],
  ])('lets a request through while maintenance is off, read %s', async (_, getState) => {
    const guard = await createGuard(getState);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  test('refuses a request with a 503 MAINTENANCE_MODE, with the message as its data', async () => {
    const guard = await createGuard(() =>
      Promise.resolve({ enabled: true, message: 'Back at 14:00 UTC.' }),
    );

    const error: unknown = await guard
      .canActivate(createContext())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      code: ERRORS.MAINTENANCE_MODE,
      message: ERROR_MESSAGES.MAINTENANCE_MODE,
      status: 503,
      data: { message: 'Back at 14:00 UTC.' },
    });
  });

  test('refuses a request without data when the state has no message', async () => {
    const guard = await createGuard(() => ({ enabled: true }));

    const error: unknown = await guard
      .canActivate(createContext())
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: ERRORS.MAINTENANCE_MODE, status: 503 });
    expect((error as ApiException).data).toBeUndefined();
  });

  test.each([
    [
      'an object',
      { maintenanceMode: { content: 'Back soon.', updatedAt: '2026-10-19T12:00:00.000Z' } },
    ],
    ['an array', ['api', 'admin']],
    ['a string', 'Back soon.'],
    ['null', null],
  ])('refuses a request with the state data, %s, as the error data, as it is', async (_, data) => {
    const guard = await createGuard(() => ({ enabled: true, data }));

    const error: unknown = await guard
      .canActivate(createContext())
      .catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: ERRORS.MAINTENANCE_MODE, status: 503 });
    expect((error as ApiException).data).toStrictEqual(data);
  });

  test('sends the data in place of the message when the state has both', async () => {
    const guard = await createGuard(() => ({
      enabled: true,
      message: 'Back at 14:00 UTC.',
      data: { maintenanceMode: { content: 'Back at 14:00 UTC.' } },
    }));

    const error: unknown = await guard
      .canActivate(createContext())
      .catch((caught: unknown) => caught);

    expect((error as ApiException).data).toStrictEqual({
      maintenanceMode: { content: 'Back at 14:00 UTC.' },
    });
  });

  test('lets a request through while maintenance is off, whatever its data', async () => {
    const guard = await createGuard(() => ({ enabled: false, data: { maintenanceMode: null } }));

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
  });

  test("gives getState the request's context", async () => {
    const getState = vi.fn<IMaintenanceModeGuardOptions['getState']>(() => ({ enabled: false }));
    const guard = await createGuard(getState);
    const context = createContext();

    await guard.canActivate(context);

    expect(getState).toHaveBeenCalledExactlyOnceWith(context);
  });

  test('fails closed when getState throws synchronously', async () => {
    const failure = new Error('The flag could not be parsed.');
    const guard = await createGuard(() => {
      throw failure;
    });

    await expect(guard.canActivate(createContext())).rejects.toBe(failure);
  });

  test('reads the state on every request', async () => {
    const getState = vi
      .fn<IMaintenanceModeGuardOptions['getState']>()
      .mockReturnValueOnce({ enabled: true })
      .mockReturnValueOnce({ enabled: false });
    const guard = await createGuard(getState);

    await expectToRejectCode(guard.canActivate(createContext()), ERRORS.MAINTENANCE_MODE);
    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(getState).toHaveBeenCalledTimes(2);
  });

  test('fails closed, passing on the error when the state cannot be read', async () => {
    const failure = new Error('The settings table is unreachable.');
    const guard = await createGuard(() => Promise.reject(failure));

    await expect(guard.canActivate(createContext())).rejects.toBe(failure);
  });

  test('lets other contexts through without reading the state', async () => {
    const getState = vi.fn(() => ({ enabled: true }));
    const guard = await createGuard(getState);

    await expect(guard.canActivate(createContext('rpc'))).resolves.toBe(true);
    expect(getState).not.toHaveBeenCalled();
  });

  test('fails to compile without its options', async () => {
    await expect(
      Test.createTestingModule({ providers: [MaintenanceModeGuard] }).compile(),
    ).rejects.toThrow(/MaintenanceModeGuard/);
  });
});
