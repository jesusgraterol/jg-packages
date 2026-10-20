import type { IncomingMessage, ServerResponse } from 'node:http';

import type { VersioningOptions } from '@nestjs/common';

import type { IRequestLoggingOptions } from '../request-logging/index.js';

// what configureHttpApp takes
export type IHttpAppOptions = {
  // the most a JSON or URL-encoded body may hold, such as `'1mb'`, or a number of bytes. A larger
  // body is refused with a 413, which ApiExceptionFilter answers as HTTP_EXCEPTION
  bodyLimit: string | number;

  // middleware that runs before the request log, such as `helmet()`
  securityMiddleware?:
    | ((
        request: IncomingMessage,
        response: ServerResponse,
        next: (error?: unknown) => void,
      ) => void)
    | undefined;

  // how many proxies in front of the app to trust for the client's address, such as 1 behind one
  // load balancer. Only a positive integer is applied
  trustProxyHops?: number | undefined;

  // the request log's options, or false for none. Defaults to logging every request under the
  // `HTTP` context
  requestLogging?: IRequestLoggingOptions | false | undefined;

  // how the API's routes are versioned, such as `{ type: VersioningType.URI }`
  versioning?: VersioningOptions | undefined;

  // the signals that close the app gracefully, running its shutdown hooks. Defaults to SIGINT and
  // SIGTERM
  shutdownSignals?: readonly string[] | undefined;
};

// what listenHttpApp takes
export type IListenHttpAppOptions = {
  // the port to listen on, or 0 for any free port
  port: number;

  // the address to bind, such as `'127.0.0.1'` to accept only local connections. Defaults to every
  // interface
  host?: string | undefined;
};
