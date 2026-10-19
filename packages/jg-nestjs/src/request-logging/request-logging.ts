import type { IncomingMessage, ServerResponse } from 'node:http';

import { Logger } from '@nestjs/common';

import { DEFAULT_REQUEST_LOG_CONTEXT } from './constants.js';
import type { ILoggedRequest, IRequestLoggingOptions } from './types.js';
import { buildRequestLogParams, getRequestLogLevel } from './utilities.js';

/**
 * Creates a middleware that logs each request once its response finishes, through Nest's Logger:
 * `METHOD url status Nms`, at `error` for a 5xx, `warn` for a 4xx, and `log` otherwise, with the
 * client's address, user agent, referer, and response size as structured fields when they're
 * known. The URL and the referer go through `redactUrl` first. The prefix and the levels Nest
 * prints are set on Nest's own ConsoleLogger.
 * @param options The Logger context, and how to redact URLs.
 * @returns The middleware, for `app.use`.
 * @example
 * import type { INestApplication } from '@nestjs/common';
 * import { createRequestLoggingMiddleware } from 'jg-nestjs';
 *
 * declare const app: INestApplication;
 *
 * app.use(
 *   createRequestLoggingMiddleware({
 *     redactUrl: (url) => url.replace(/token=[^&]+/, 'token=[redacted]'),
 *   }),
 * );
 */
export const createRequestLoggingMiddleware = ({
  context = DEFAULT_REQUEST_LOG_CONTEXT,
  redactUrl = (url: string): string => url,
}: IRequestLoggingOptions = {}): ((
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
) => void) => {
  const logger = new Logger(context);
  return (incomingRequest, response, next) => {
    // Express adds originalUrl and ip, which plain Node.js requests lack
    const request: ILoggedRequest = incomingRequest;
    const startedAt = performance.now();
    response.once('finish', () => {
      const status = response.statusCode;
      const url = redactUrl(request.originalUrl ?? request.url ?? '');
      const duration = Math.round(performance.now() - startedAt);
      logger[getRequestLogLevel(status)](
        `${request.method ?? 'UNKNOWN'} ${url} ${String(status)} ${String(duration)}ms`,
        buildRequestLogParams(request, response, redactUrl),
      );
    });
    next();
  };
};
