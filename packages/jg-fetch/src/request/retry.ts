import {
  NON_RETRYABLE_STATUS_CODES,
  type IFetchErrorKind,
  type IHttpMethod,
} from '../shared/index.js';

// what decides whether a failed attempt retries
export type IRetryInput = {
  // the attempt that failed, starting at 1
  attempt: number;
  method: IHttpMethod;
  kind: IFetchErrorKind;

  // the error's code: the API's own code, or the kind
  code: string;
  status: number | null;
  isAttemptTimeout: boolean;
  retryAfterMs: number | null;
  hasStreamBody: boolean;

  // the milliseconds left before the whole call times out
  remainingMs: number;
  retryDelaysMs: readonly number[];
  retryMethods: readonly IHttpMethod[];
  retryStatusCodes: readonly number[];
  nonRetryableErrorCodes: readonly string[];
  maxRetryAfterMs: number;
};

// whether to retry, and after how long
export type IRetryDecision = { shouldRetry: true; delayMs: number } | { shouldRetry: false };

/**
 * Checks whether the failure itself can succeed on another attempt.
 * @param input The failure.
 * @returns Whether it can.
 */
const isRetryableFailure = ({
  kind,
  code,
  status,
  isAttemptTimeout,
  retryStatusCodes,
  nonRetryableErrorCodes,
}: IRetryInput): boolean => {
  if (nonRetryableErrorCodes.includes(code)) {
    return false;
  }
  if (kind === 'NETWORK_ERROR') {
    return true;
  }
  if (kind === 'TIMEOUT') {
    return isAttemptTimeout;
  }
  if ((kind === 'HTTP_ERROR' || kind === 'API_ERROR') && status !== null) {
    return !NON_RETRYABLE_STATUS_CODES.includes(status) && retryStatusCodes.includes(status);
  }
  return false;
};

/**
 * Decides whether a failed attempt retries. It retries when a delay remains for it, the method may
 * retry, the body isn't a stream, and the failure is a network error, the attempt's own timeout,
 * or a status in retryStatusCodes that NON_RETRYABLE_STATUS_CODES doesn't list, with a code
 * nonRetryableErrorCodes doesn't list. A 429 retries only with Retry-After. The wait is the
 * larger of the scheduled delay and Retry-After, and the call stops instead when Retry-After
 * exceeds maxRetryAfterMs, or the wait doesn't fit in the time left.
 * @param input The failure and the retry options.
 * @returns The decision.
 */
export const decideRetry = (input: IRetryInput): IRetryDecision => {
  const scheduledMs = input.retryDelaysMs[input.attempt - 1];
  if (
    scheduledMs === undefined ||
    !input.retryMethods.includes(input.method) ||
    input.hasStreamBody ||
    !isRetryableFailure(input) ||
    (input.status === 429 && input.retryAfterMs === null) ||
    (input.retryAfterMs !== null && input.retryAfterMs > input.maxRetryAfterMs)
  ) {
    return { shouldRetry: false };
  }
  const delayMs = Math.max(scheduledMs, input.retryAfterMs ?? 0);
  return delayMs < input.remainingMs ? { shouldRetry: true, delayMs } : { shouldRetry: false };
};
