import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { MAINTENANCE_MODE_GUARD_OPTIONS } from './constants.js';
import type { IMaintenanceModeGuardOptions } from './types.js';

/**
 * Refuses HTTP requests with a 503 while the API is down for maintenance, reading the state on every
 * request, given its context, so turning it on or off needs no restart and a route can be exempted
 * by its metadata. The error, MAINTENANCE_MODE, carries the state's data as it is, or else its
 * message as `{ message }`, and the filter doesn't report it. It fails closed: an error reading the
 * state refuses the request. Other contexts, such as microservices, pass. Its options come from
 * MAINTENANCE_MODE_GUARD_OPTIONS, and the app fails to start without them.
 * @example
 * import { Module } from '@nestjs/common';
 * import { APP_GUARD } from '@nestjs/core';
 * import { MAINTENANCE_MODE_GUARD_OPTIONS, MaintenanceModeGuard } from 'jg-nestjs';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: MAINTENANCE_MODE_GUARD_OPTIONS,
 *       useValue: { getState: () => ({ enabled: process.env['MAINTENANCE_MODE'] === 'true' }) },
 *     },
 *     { provide: APP_GUARD, useClass: MaintenanceModeGuard },
 *   ],
 * })
 * export class AppModule {}
 */
@Injectable()
export class MaintenanceModeGuard implements CanActivate {
  /**
   * Creates the guard. Nest injects its options.
   * @param __options How to read the maintenance state.
   */
  constructor(
    @Inject(MAINTENANCE_MODE_GUARD_OPTIONS)
    private readonly __options: IMaintenanceModeGuardOptions,
  ) {}

  /**
   * Lets an HTTP request through unless the API is down for maintenance.
   * @param context The request's context.
   * @returns A promise that resolves to true when the request may go on.
   * @throws
   * - MAINTENANCE_MODE: The service is temporarily unavailable for maintenance. Try again shortly.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const { enabled, message, data } = await this.__options.getState(context);
    if (enabled) {
      throw new ApiException(ERROR_MESSAGES.MAINTENANCE_MODE, {
        code: ERRORS.MAINTENANCE_MODE,
        status: 503,
        ...(data !== undefined ? { data } : message !== undefined ? { data: { message } } : {}),
      });
    }
    return true;
  }
}
