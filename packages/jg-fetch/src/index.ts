// types
export type {
  IAttemptContext,
  IHeadersInit,
  IHttpMethod,
  IParseAs,
  IQueryParams,
  IQueryScalar,
  IRequestOptions,
  IRequestResult,
  IResponseMeta,
  ISchema,
  IRetryContext,
} from './shared/index.js';
export type { IFetchErrorKind } from './shared/index.js';

// constants
export {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_RETRY_AFTER_SECONDS,
  DEFAULT_RETRY_DELAYS_SECONDS,
  DEFAULT_RETRY_METHODS,
  DEFAULT_RETRY_STATUS_CODES,
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
  NON_RETRYABLE_STATUS_CODES,
} from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// errors
export { FetchException, type IFetchExceptionInit } from './fetch-exception/index.js';

// Retry-After
export { parseRetryAfterMs } from './retry-after/index.js';

// requests
export { request } from './request/index.js';
