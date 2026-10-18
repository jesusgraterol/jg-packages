import type { FetchException } from '../fetch-exception/index.js';

// the HTTP methods request sends
export type IHttpMethod = 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// a query parameter's value. null, undefined, and empty strings are left out
export type IQueryScalar = string | number | boolean | bigint | null | undefined;

// the query parameters appended to the URL. An array repeats the key once per item
export type IQueryParams = Record<string, IQueryScalar | readonly IQueryScalar[]>;

// how request reads a successful response:
// - envelope: a jg-api-response envelope, resolving to its data
// - json: parsed JSON
// - text: a string
// - bytes: a Uint8Array
// - blob: a Blob
// - response: the Response itself, unread
// - none: nothing, the body is discarded
export type IParseAs = 'envelope' | 'json' | 'text' | 'bytes' | 'blob' | 'response' | 'none';

// validates parsed data and returns it typed, which a Zod schema does
export type ISchema<T> = {
  parse(value: unknown): T;
};

// the headers the Headers constructor accepts: Headers, [name, value] pairs, or a record
export type IHeadersInit = ConstructorParameters<typeof Headers>[0];

// what a headers function receives on each attempt
export type IAttemptContext = {
  // the attempt's number, starting at 1
  attempt: number;

  // aborts when the attempt is cancelled, for work such as refreshing a token
  signal: AbortSignal;
};

// what request knows about the last response, successful or not
export type IResponseMeta = {
  // the HTTP status, or null when no response arrived
  status: number | null;

  // the response's headers, or null when no response arrived
  headers: Headers | null;

  // the URL, without its query string or fragment, which can hold tokens
  url: string;

  // the number of attempts made
  attempts: number;

  // the milliseconds the whole call took, retries and waits included
  durationMs: number;
};

// what request resolves to: the data and no error, or no data and the error
export type IRequestResult<T> =
  | { data: T; error: null; meta: IResponseMeta }
  | { data: null; error: FetchException; meta: IResponseMeta };

// what onRetry receives before each retry
export type IRetryContext = {
  // the attempt that failed, starting at 1
  attempt: number;

  // why it failed
  error: FetchException;

  // the milliseconds request waits before the next attempt
  delayMs: number;
};

// the options request accepts
export type IRequestOptions<T> = {
  // the HTTP method. Defaults to 'GET'
  method?: IHttpMethod;

  // the URL a relative url resolves against. A URL that resolves to another origin fails with
  // INVALID_URL
  baseUrl?: string | URL;

  // the query parameters appended to the URL
  query?: IQueryParams;

  // the headers, or a function that builds them for each attempt, such as to add a fresh token
  headers?: IHeadersInit | ((context: IAttemptContext) => IHeadersInit | Promise<IHeadersInit>);

  // the body. Plain objects and arrays are sent as JSON, with Content-Type: application/json
  // unless the headers set one. A string, Blob, ArrayBuffer or view of one, FormData,
  // URLSearchParams, or ReadableStream is sent as it is. Any other value, such as a Map, a Date,
  // or a number, is an INVALID_BODY error, sent nowhere
  body?: RequestInit['body'] | Record<string, unknown> | readonly unknown[];

  // how a successful response is read. Defaults to 'json'
  parseAs?: IParseAs;

  // validates the parsed data, or the envelope's data, such as a Zod schema
  schema?: ISchema<T>;

  // aborts the call. An abort whose reason is a TimeoutError, such as AbortSignal.timeout's,
  // reports TIMEOUT, and any other ABORTED
  signal?: AbortSignal;

  // the seconds the whole call may take, retries and waits included. Defaults to
  // DEFAULT_TIMEOUT_SECONDS
  timeoutSeconds?: number;

  // the seconds each attempt may take. An attempt that runs out retries. No limit by default
  attemptTimeoutSeconds?: number;

  // the waits before each retry, in seconds; one retry per item. Defaults to
  // DEFAULT_RETRY_DELAYS_SECONDS, and [] turns retries off
  retryDelaysSeconds?: readonly number[];

  // the methods that may retry. Defaults to DEFAULT_RETRY_METHODS
  retryMethods?: readonly IHttpMethod[];

  // the statuses that may retry. Defaults to DEFAULT_RETRY_STATUS_CODES, and
  // NON_RETRYABLE_STATUS_CODES never retry
  retryStatusCodes?: readonly number[];

  // the API error codes, from an envelope's error, that never retry
  nonRetryableErrorCodes?: readonly string[];

  // the longest Retry-After wait a retry accepts, in seconds. Defaults to
  // DEFAULT_MAX_RETRY_AFTER_SECONDS
  maxRetryAfterSeconds?: number;

  // the largest body the buffered parseAs modes read, counted as it streams. Defaults to
  // DEFAULT_MAX_RESPONSE_BYTES
  maxResponseBytes?: number;

  // the other fetch options, such as credentials, cache, or redirect
  init?: Omit<RequestInit, 'method' | 'headers' | 'body' | 'signal'>;

  // called before each retry. Whatever it throws is ignored, so request still never throws
  onRetry?: (context: IRetryContext) => void;
};
