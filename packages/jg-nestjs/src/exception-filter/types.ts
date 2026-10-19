import type { IncomingMessage } from 'node:http';

import type { IExceptionSeverity } from 'jg-exception';

// what ApiExceptionFilter hands its reporter about one error
export type IErrorReport = {
  // the error a handler, guard, pipe, or middleware threw
  error: unknown;

  // the status the response got
  status: number;

  // the severity the throw site gave an Exception, if any
  severity: IExceptionSeverity | undefined;

  // the request that failed
  request: IncomingMessage;

  // the request's URL, already through redactUrl
  url: string;
};

// how ApiExceptionFilter reports and logs errors, provided as API_EXCEPTION_FILTER_OPTIONS
export type IApiExceptionFilterOptions = {
  // sends an error to an error tracker. It runs without delaying the response, and a throw or a
  // rejection is logged
  report?: ((report: IErrorReport) => void | Promise<void>) | undefined;

  // gives the status of an error that is neither an ApiException nor an HttpException, such as one
  // from a library. A value that isn't an integer from 400 to 599 is ignored
  resolveStatus?: ((error: unknown) => number | undefined) | undefined;

  // the statuses that are never reported. Defaults to 401 and 429
  ignoredStatuses?: readonly number[] | undefined;

  // the error codes that are never reported. Defaults to CORS_ORIGIN_NOT_ALLOWED
  ignoredCodes?: readonly string[] | undefined;

  // removes secrets from a URL before it's logged or reported, such as a token in the query.
  // Defaults to leaving it as it is
  redactUrl?: ((url: string) => string) | undefined;
};

// the filter's options with their defaults filled in
export type IResolvedFilterOptions = {
  report: IApiExceptionFilterOptions['report'];
  resolveStatus: IApiExceptionFilterOptions['resolveStatus'];
  ignoredStatuses: readonly number[];
  ignoredCodes: readonly string[];
  redactUrl: (url: string) => string;
};
