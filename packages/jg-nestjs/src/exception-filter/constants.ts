import { ERRORS } from '../shared/index.js';

// the token ApiExceptionFilter reads its options from, through any provider, such as `useValue`, or
// `useFactory` to build them from injected services
export const API_EXCEPTION_FILTER_OPTIONS = Symbol('API_EXCEPTION_FILTER_OPTIONS');

// the statuses never reported: an unauthenticated request and a rate-limited one
export const DEFAULT_IGNORED_STATUSES: readonly number[] = [401, 429];

/*
 * The codes never reported: a browser on an origin the API doesn't serve, the API down for
 * maintenance on purpose, a blocked IP address, an upload the client got wrong or abandoned, and a
 * failed human verification.
 */
export const DEFAULT_IGNORED_CODES: readonly string[] = [
  ERRORS.CORS_ORIGIN_NOT_ALLOWED,
  ERRORS.MAINTENANCE_MODE,
  ERRORS.IP_BLOCKED,
  ERRORS.UPLOAD_REJECTED,
  ERRORS.TURNSTILE_FAILED,
];
