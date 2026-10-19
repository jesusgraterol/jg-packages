import { invalidArgument } from '../shared/index.js';
import { FALLBACK_RETRY_MS, IMF_FIXDATE_PATTERN } from './constants.js';
import type { IGithubRateLimitDeadlineOptions, IGithubResponseHeaders } from './types.js';

/**
 * Reads one header, by its lowercase name, as a single string.
 * @param headers The headers.
 * @param name The header's lowercase name.
 * @returns Its value, or null when it's missing or repeated.
 */
const readHeader = (headers: IGithubResponseHeaders, name: string): string | null => {
  const value = headers instanceof Headers ? headers.get(name) : headers[name];
  return typeof value === 'string' ? value : null;
};

/**
 * Reads Retry-After as a deadline: whole seconds from now, or a strict IMF-fixdate.
 * @param retryAfter The header's value.
 * @param now The current time, in milliseconds.
 * @returns The deadline in milliseconds, or NaN when the value isn't one.
 */
const readRetryAfter = (retryAfter: string, now: number): number => {
  const seconds = /^\d+$/.test(retryAfter) ? Number(retryAfter) : NaN;
  if (Number.isSafeInteger(seconds)) {
    return now + seconds * 1000;
  }
  return IMF_FIXDATE_PATTERN.test(retryAfter) ? Date.parse(retryAfter) : NaN;
};

/**
 * Gives the time to retry a GitHub request at after a rate limit, or null when the response isn't
 * rate limited. A 429 is, and so is a 403 with Retry-After, with no requests remaining, or with a
 * rate-limit message, and a success that used the last remaining request. The deadline is the
 * latest of Retry-After, as whole seconds or a strict IMF-fixdate, and `x-ratelimit-reset` when no
 * requests remain, counting only future times; without one, it's a minute from now, doubled for
 * each retry already made.
 * @param options The response's status and headers, the retries made, and the time.
 * @returns The time to retry at, or null.
 * @example
 * import { getGithubRateLimitDeadline } from 'jg-github';
 *
 * declare const response: Response;
 *
 * const deadline = getGithubRateLimitDeadline({
 *   status: response.status,
 *   headers: response.headers,
 *   retryCount: 0,
 * });
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 */
export const getGithubRateLimitDeadline = ({
  status,
  headers,
  retryCount,
  hasRateLimitMessage = false,
  now = new Date(),
}: IGithubRateLimitDeadlineOptions): Date | null => {
  if (!Number.isSafeInteger(status) || status < 100 || status > 599) {
    throw invalidArgument('status');
  }
  if (!(headers instanceof Headers) && (typeof headers !== 'object' || headers === null)) {
    throw invalidArgument('headers');
  }
  if (!Number.isSafeInteger(retryCount) || retryCount < 0) {
    throw invalidArgument('retryCount');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw invalidArgument('now');
  }
  const nowMs = now.getTime();
  const retryAfter = readHeader(headers, 'retry-after');
  const remaining = readHeader(headers, 'x-ratelimit-remaining');
  const reset = readHeader(headers, 'x-ratelimit-reset');

  // the last successful request can use up the primary limit before GitHub answers with an error
  const hasExhaustedSuccess = status >= 200 && status < 300 && remaining === '0';
  if (status !== 403 && status !== 429 && !hasExhaustedSuccess) {
    return null;
  }
  if (status === 403 && retryAfter === null && remaining !== '0' && !hasRateLimitMessage) {
    return null;
  }

  const deadlines: number[] = [];
  if (retryAfter !== null) {
    const deadline = readRetryAfter(retryAfter, nowMs);
    if (Number.isSafeInteger(deadline) && deadline > nowMs) {
      deadlines.push(deadline);
    }
  }
  if (remaining === '0' && reset !== null && /^\d+$/.test(reset)) {
    const deadline = Number(reset) * 1000;
    if (Number.isSafeInteger(deadline) && deadline > nowMs) {
      deadlines.push(deadline);
    }
  }
  return new Date(
    deadlines.length === 0 ? nowMs + FALLBACK_RETRY_MS * 2 ** retryCount : Math.max(...deadlines),
  );
};
