import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { IP_BLOCKLIST_GUARD_OPTIONS } from './constants.js';
import type { IIpBlocklistGuardOptions, IIpBlocklistRequest } from './types.js';
import { normalizeIp } from './utilities.js';

/**
 * Refuses HTTP requests from blocked IP addresses with a 403, IP_BLOCKED, which carries no data and
 * which the filter doesn't report. It reads the client's address with `getIp`, Express's
 * `request.ip` by default, normalizes it with normalizeIp, and lets a request without one through.
 * It fails closed: an error from `isBlocked` refuses the request. It never echoes the address or
 * changes the request. Other contexts, such as microservices, pass. Its options come from
 * IP_BLOCKLIST_GUARD_OPTIONS, and the app fails to start without them.
 * @example
 * import { Module } from '@nestjs/common';
 * import { APP_GUARD } from '@nestjs/core';
 * import { IP_BLOCKLIST_GUARD_OPTIONS, IpBlocklistGuard } from 'jg-nestjs';
 *
 * const BLOCKED_IPS = new Set(['203.0.113.7']);
 *
 * @Module({
 *   providers: [
 *     { provide: IP_BLOCKLIST_GUARD_OPTIONS, useValue: { isBlocked: (ip: string) => BLOCKED_IPS.has(ip) } },
 *     { provide: APP_GUARD, useClass: IpBlocklistGuard },
 *   ],
 * })
 * export class AppModule {}
 */
@Injectable()
export class IpBlocklistGuard implements CanActivate {
  /**
   * Creates the guard. Nest injects its options.
   * @param __options How to read the client's address and check it.
   */
  constructor(
    @Inject(IP_BLOCKLIST_GUARD_OPTIONS)
    private readonly __options: IIpBlocklistGuardOptions,
  ) {}

  /**
   * Lets an HTTP request through unless its client's address is blocked.
   * @param context The request's context.
   * @returns A promise that resolves to true when the request may go on.
   * @throws
   * - IP_BLOCKED: Requests from this IP address are blocked. Contact support if you believe this is an error.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<IIpBlocklistRequest>();
    const { getIp, isBlocked } = this.__options;
    const ip = getIp === undefined ? request.ip : getIp(request);
    if (ip === undefined || ip.trim() === '') {
      return true;
    }
    if (await isBlocked(normalizeIp(ip))) {
      throw new ApiException(ERROR_MESSAGES.IP_BLOCKED, { code: ERRORS.IP_BLOCKED, status: 403 });
    }
    return true;
  }
}
