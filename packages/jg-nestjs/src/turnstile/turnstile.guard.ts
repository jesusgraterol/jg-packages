import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Exception } from 'jg-exception';
import { request } from 'jg-fetch';

import { ApiException } from '../api-exception/index.js';
import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import {
  CLIENT_ERROR_CODES,
  MAX_SITEVERIFY_RESPONSE_BYTES,
  MAX_TOKEN_LENGTH,
  SITEVERIFY_URL,
  TURNSTILE_GUARD_OPTIONS,
  TURNSTILE_TOKEN_HEADER,
} from './constants.js';
import { TurnstileAction } from './turnstile-action.decorator.js';
import type { ISiteverifyResponse, ITurnstileGuardOptions } from './types.js';
import { readSiteverifyResponse } from './validations.js';

/*
 * the 403 a request gets when its token doesn't verify, which tells the client nothing about why;
 * the reason, when siteverify gave one, is kept as the cause, which the response never includes
 */
const turnstileFailed = (cause?: unknown): ApiException =>
  new ApiException(ERROR_MESSAGES.TURNSTILE_FAILED, {
    code: ERRORS.TURNSTILE_FAILED,
    status: 403,
    cause,
  });

// the 503 a request gets when the token can't be verified, with the reason kept as the cause
const turnstileUnavailable = (cause: unknown): ApiException =>
  new ApiException(ERROR_MESSAGES.TURNSTILE_UNAVAILABLE, {
    code: ERRORS.TURNSTILE_UNAVAILABLE,
    status: 503,
    cause,
  });

// reads siteverify's answer for jg-fetch, which reports what it throws as RESPONSE_INVALID
const SITEVERIFY_RESPONSE_SCHEMA = {
  parse: (value: unknown): ISiteverifyResponse => {
    const response = readSiteverifyResponse(value);
    if (response === undefined) {
      throw new Exception("Siteverify's answer has an unexpected shape.", {
        code: ERRORS.TURNSTILE_UNAVAILABLE,
      });
    }
    return response;
  },
};

/**
 * Lets an HTTP request through only when the Cloudflare Turnstile token in its
 * `x-turnstile-token` header verifies: siteverify says it's valid, it was solved on one of the
 * allowed hostnames, and, when the route sets one with `@TurnstileAction`, for that action. Each
 * token can be verified once, so the client renders a new widget for each request.
 *
 * A missing, invalid, expired, or reused token, or one from another hostname or action, gets a
 * 403 with TURNSTILE_FAILED, which isn't reported; when siteverify refused the token, its error
 * codes are in the cause's data. When siteverify can't be reached, answers with an error, or
 * refuses the secret, the request gets a 503 with TURNSTILE_UNAVAILABLE, which is reported with the
 * reason as its cause. Neither tells the client what Cloudflare answered.
 * Siteverify is called through jg-fetch's `request`, which retries the POST on a network error,
 * a timeout, or a 5xx, with the same idempotency key, so Cloudflare verifies the token once. Other
 * contexts, such as microservices, pass. Its options come from TURNSTILE_GUARD_OPTIONS, and the
 * app fails to start without them.
 * @example
 * import { Module } from '@nestjs/common';
 * import { TURNSTILE_GUARD_OPTIONS, TurnstileGuard } from 'jg-nestjs/turnstile';
 *
 * @Module({
 *   providers: [
 *     {
 *       provide: TURNSTILE_GUARD_OPTIONS,
 *       useValue: {
 *         secretKey: process.env['TURNSTILE_SECRET_KEY'] ?? '',
 *         allowedHostnames: ['app.example.com'],
 *       },
 *     },
 *     TurnstileGuard,
 *   ],
 *   exports: [TurnstileGuard],
 * })
 * export class HumanVerificationModule {}
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  /**
   * Creates the guard. Nest injects its arguments.
   * @param __options The secret key and the allowed hostnames.
   * @param __reflector Reads the action a route sets with `@TurnstileAction`.
   */
  constructor(
    @Inject(TURNSTILE_GUARD_OPTIONS) private readonly __options: ITurnstileGuardOptions,
    @Inject(Reflector) private readonly __reflector: Reflector,
  ) {}

  /**
   * Lets an HTTP request through when its Turnstile token verifies.
   * @param context The request's context.
   * @returns A promise that resolves to true when the request may go on.
   * @throws
   * - TURNSTILE_FAILED: The human verification failed.
   * - TURNSTILE_UNAVAILABLE: Human verification is temporarily unavailable. Try again shortly.
   */
  public async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const token = context.switchToHttp().getRequest<IncomingMessage>().headers[
      TURNSTILE_TOKEN_HEADER
    ];
    // Node.js joins a repeated header into one value, which siteverify then refuses
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
      throw turnstileFailed();
    }

    const { data, error } = await request(SITEVERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret: this.__options.secretKey,
        response: token,
        idempotency_key: randomUUID(),
      }),
      schema: SITEVERIFY_RESPONSE_SCHEMA,
      retryMethods: ['POST'],
      maxResponseBytes: MAX_SITEVERIFY_RESPONSE_BYTES,
      init: { redirect: 'error' },
    });
    if (error !== null) {
      throw turnstileUnavailable(error);
    }
    if (!data.success) {
      if (data.errorCodes.some((code) => CLIENT_ERROR_CODES.includes(code))) {
        throw turnstileFailed(
          new Exception('Siteverify refused the token.', {
            code: ERRORS.TURNSTILE_FAILED,
            data: { errorCodes: data.errorCodes },
          }),
        );
      }
      throw turnstileUnavailable(
        new Exception('Siteverify refused the verification.', {
          code: ERRORS.TURNSTILE_UNAVAILABLE,
          data: { errorCodes: data.errorCodes },
        }),
      );
    }

    const action = this.__reflector.getAllAndOverride(TurnstileAction, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      data.hostname === undefined ||
      !this.__options.allowedHostnames.includes(data.hostname) ||
      (action !== undefined && data.action !== action)
    ) {
      throw turnstileFailed();
    }
    return true;
  }
}
