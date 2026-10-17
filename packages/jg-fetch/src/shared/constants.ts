import type { IHttpMethod } from './types.js';

// the seconds a whole call may take, retries and waits included, unless timeoutSeconds says
// otherwise
export const DEFAULT_TIMEOUT_SECONDS = 15;

// the waits before each retry, in seconds: two retries, after 3 and then 5 seconds
export const DEFAULT_RETRY_DELAYS_SECONDS: readonly number[] = Object.freeze([3, 5]);

// the methods that retry by default, which are safe to repeat
export const DEFAULT_RETRY_METHODS: readonly IHttpMethod[] = Object.freeze([
  'GET',
  'HEAD',
  'OPTIONS',
]);

// the statuses that retry by default, because a later attempt can succeed
export const DEFAULT_RETRY_STATUS_CODES: readonly number[] = Object.freeze([
  408, 429, 500, 502, 503, 504,
]);

// the statuses that never retry, even when retryStatusCodes lists them
export const NON_RETRYABLE_STATUS_CODES: readonly number[] = Object.freeze([
  400, 401, 402, 403, 404, 405, 409, 410, 413, 422,
]);

// the longest Retry-After wait a retry accepts, in seconds, unless maxRetryAfterSeconds says
// otherwise
export const DEFAULT_MAX_RETRY_AFTER_SECONDS = 30;

// the largest response body the buffered parseAs modes read, in bytes: 10 MiB
export const DEFAULT_MAX_RESPONSE_BYTES = 10_485_760;

// the longest timeout a timer can hold, in seconds, which is 2^31 - 1 milliseconds
export const MAX_TIMEOUT_SECONDS = 2_147_483;
