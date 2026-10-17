import { Exception, type IJSONValue } from 'jg-exception';

import { ERROR_MESSAGES, type IFetchErrorKind, type IHttpMethod } from '../shared/index.js';

// what a FetchException carries besides its kind
export type IFetchExceptionInit = {
  // the message. Defaults to the kind's message
  message?: string;

  // the code. Defaults to the kind; an API error's own code takes its place
  code?: string;

  // the envelope error's data, for an API error
  data?: IJSONValue;

  // the HTTP status, or null when no response arrived
  status?: number | null;

  // the response's headers, or null when no response arrived
  headers?: Headers | null;

  // the response body: parsed JSON when it is JSON, otherwise its text
  body?: unknown;

  // the wait the server asked for with Retry-After, in milliseconds
  retryAfterMs?: number | null;

  // the request's method
  method: IHttpMethod;

  // the request's URL, without its query string or fragment
  url: string;

  // the number of attempts made
  attempts: number;

  // the milliseconds the whole call took
  durationMs: number;

  // the original error, such as a TypeError from fetch or a schema's error
  cause?: unknown;
};

/**
 * The error request returns when a call fails, never throws. kind says what failed, one of the
 * ERRORS codes. For an API error, code, message, and data are the envelope error's; otherwise code
 * is the kind. Its message never includes the URL or the body.
 * @example
 * const { data, error } = await request<IUser>('/users/1', { baseUrl, parseAs: 'envelope' });
 * if (error) {
 *   error.kind; // 'API_ERROR'
 *   error.code; // 'USER_NOT_FOUND', the envelope error's code
 *   error.data; // { id: 1 }, the envelope error's data
 *   error.status; // 404
 * }
 */
export class FetchException extends Exception {
  // what failed, one of the ERRORS codes
  readonly kind: IFetchErrorKind;

  // the HTTP status, or null when no response arrived
  readonly status: number | null;

  // the response's headers, or null when no response arrived
  readonly headers: Headers | null;

  // the response body: parsed JSON when it is JSON, otherwise its text
  readonly body: unknown;

  // the wait the server asked for with Retry-After, in milliseconds, or null without one
  readonly retryAfterMs: number | null;

  // the request's method
  readonly method: IHttpMethod;

  // the request's URL, without its query string or fragment
  readonly url: string;

  // the number of attempts made
  readonly attempts: number;

  // the milliseconds the whole call took
  readonly durationMs: number;

  constructor(kind: IFetchErrorKind, init: IFetchExceptionInit) {
    super(init.message ?? ERROR_MESSAGES[kind], {
      code: init.code ?? kind,
      data: init.data,
      cause: init.cause,
    });
    this.name = 'FetchException';
    this.kind = kind;
    this.status = init.status ?? null;
    this.headers = init.headers ?? null;
    this.body = init.body;
    this.retryAfterMs = init.retryAfterMs ?? null;
    this.method = init.method;
    this.url = init.url;
    this.attempts = init.attempts;
    this.durationMs = init.durationMs;
  }
}
