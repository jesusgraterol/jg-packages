import type { NestExpressApplication } from '@nestjs/platform-express';

import { createRequestLoggingMiddleware } from '../request-logging/index.js';
import { DEFAULT_SHUTDOWN_SIGNALS } from './constants.js';
import type { IHttpAppOptions } from './types.js';

/**
 * Configures an Express-based Nest app before it listens, in this order: JSON and URL-encoded
 * body parsers with `bodyLimit`, the security middleware, the trusted proxy hops, the request log,
 * versioning, and shutdown hooks. A route that needs the raw body, such as a webhook that checks
 * a signature, registers its own parser with `app.use` before this call, and the JSON parser then
 * leaves its body alone.
 * @param app The app, from `NestFactory.create<NestExpressApplication>`.
 * @param options The body limit, and the optional security middleware, proxy hops, request log,
 * versioning, and shutdown signals.
 * @example
 * import { VersioningType } from '@nestjs/common';
 * import type { NestExpressApplication } from '@nestjs/platform-express';
 * import { configureHttpApp } from 'jg-nestjs';
 *
 * declare const app: NestExpressApplication;
 *
 * configureHttpApp(app, {
 *   bodyLimit: '1mb',
 *   trustProxyHops: 1,
 *   versioning: { type: VersioningType.URI },
 * });
 */
export const configureHttpApp = (
  app: NestExpressApplication,
  {
    bodyLimit,
    securityMiddleware,
    trustProxyHops,
    requestLogging = {},
    versioning,
    shutdownSignals = DEFAULT_SHUTDOWN_SIGNALS,
  }: IHttpAppOptions,
): void => {
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { extended: true, limit: bodyLimit });
  if (securityMiddleware !== undefined) {
    app.use(securityMiddleware);
  }
  if (trustProxyHops !== undefined && Number.isSafeInteger(trustProxyHops) && trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
  if (requestLogging !== false) {
    app.use(createRequestLoggingMiddleware(requestLogging));
  }
  if (versioning !== undefined) {
    app.enableVersioning(versioning);
  }
  app.enableShutdownHooks([...shutdownSignals]);
};
