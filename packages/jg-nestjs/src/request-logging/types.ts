import type { IncomingMessage } from 'node:http';

// what createRequestLoggingMiddleware takes
export type IRequestLoggingOptions = {
  // the Logger context the request log is written under. Defaults to `HTTP`
  context?: string | undefined;

  // removes secrets from a URL or a referer before it's logged, such as a token in the query.
  // Defaults to leaving it as it is
  redactUrl?: ((url: string) => string) | undefined;
};

// a request as the log reads it, with what Express adds when it's there
export type ILoggedRequest = IncomingMessage & { originalUrl?: string; ip?: string };

// what a request's log line carries besides its message, each field only when it's known
export type IRequestLogParams = {
  ip?: string;
  userAgent?: string;
  referer?: string;
  responseSize?: number;
};
