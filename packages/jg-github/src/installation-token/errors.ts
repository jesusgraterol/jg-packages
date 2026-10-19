import { Exception } from 'jg-exception';
import type { FetchException } from 'jg-fetch';

import { getGithubRateLimitDeadline } from '../rate-limit/index.js';
import { ERRORS, invalidArgument, isRecord } from '../shared/index.js';
import { INVALID_ARGUMENT_KINDS, RESPONSE_INVALID_KINDS } from './constants.js';
import type { IScopeMismatch } from './utilities.js';

// what a request failure's data holds
type IRequestFailure = {
  kind: string;
  status: number | null;
  rateLimitDeadline: string | null;
};

/**
 * Builds the exception for an answer from GitHub that isn't in the expected format, without the
 * answer, which can hold the token.
 * @param redact The credentials the request used or received.
 * @param isRevoked Whether the token the answer held was revoked, or undefined without one.
 * @returns The GITHUB_RESPONSE_INVALID exception.
 */
export const responseInvalid = (redact: readonly string[], isRevoked?: boolean): Exception =>
  new Exception("GitHub's response isn't in the expected format.", {
    code: ERRORS.GITHUB_RESPONSE_INVALID,
    ...(isRevoked === undefined ? {} : { data: { isRevoked } }),
    redact,
  });

/**
 * Builds the exception for a token whose scope isn't the one requested.
 * @param mismatch What differs.
 * @param isRevoked Whether the token was revoked.
 * @param redact The credentials the request used or received.
 * @returns The GITHUB_TOKEN_SCOPE_MISMATCH exception.
 */
export const scopeMismatch = (
  mismatch: IScopeMismatch,
  isRevoked: boolean,
  redact: readonly string[],
): Exception =>
  new Exception("The installation token's scope isn't the one requested.", {
    code: ERRORS.GITHUB_TOKEN_SCOPE_MISMATCH,
    data: { mismatch, isRevoked },
    redact,
  });

/**
 * Builds the exception for a token that had expired when it arrived.
 * @param isRevoked Whether the token was revoked.
 * @param redact The credentials the request used or received.
 * @returns The GITHUB_TOKEN_EXPIRED exception.
 */
export const tokenExpired = (isRevoked: boolean, redact: readonly string[]): Exception =>
  new Exception('The installation token had already expired.', {
    code: ERRORS.GITHUB_TOKEN_EXPIRED,
    data: { isRevoked },
    redact,
  });

/**
 * Describes a failed request from jg-fetch's error, without its body, which can hold a token:
 * the kind of failure, the status, and the rate limit's deadline, when there's one.
 * @param error jg-fetch's error.
 * @returns The failure.
 */
const describeFailure = (error: FetchException): IRequestFailure => {
  const body = error.body;
  const hasRateLimitMessage =
    isRecord(body) && typeof body['message'] === 'string' && /rate limit/i.test(body['message']);
  const deadline =
    error.status === null || error.headers === null
      ? null
      : getGithubRateLimitDeadline({
          status: error.status,
          headers: error.headers,
          retryCount: 0,
          hasRateLimitMessage,
        });
  return {
    kind: error.kind,
    status: error.status,
    rateLimitDeadline: deadline?.toISOString() ?? null,
  };
};

/**
 * Turns jg-fetch's error into jg-github's own, without the cause, whose body can hold a token.
 * @param error jg-fetch's error.
 * @param redact The credentials the request used.
 * @returns The exception.
 */
export const fromFetchError = (error: FetchException, redact: readonly string[]): Exception => {
  if (INVALID_ARGUMENT_KINDS.has(error.kind)) {
    return invalidArgument('options');
  }
  if (RESPONSE_INVALID_KINDS.has(error.kind)) {
    return responseInvalid(redact);
  }
  return new Exception('The GitHub request failed.', {
    code: ERRORS.GITHUB_REQUEST_FAILED,
    data: describeFailure(error),
    redact,
  });
};

/**
 * Builds the exception for a token GitHub didn't revoke.
 * @param kind jg-fetch's kind of failure, or `UNEXPECTED_STATUS` for an answer other than 204.
 * @param status The status, or null without an answer.
 * @param redact The token.
 * @returns The GITHUB_TOKEN_REVOKE_FAILED exception.
 */
export const revokeFailed = (
  kind: string,
  status: number | null,
  redact: readonly string[],
): Exception =>
  new Exception("The installation token couldn't be revoked.", {
    code: ERRORS.GITHUB_TOKEN_REVOKE_FAILED,
    data: { kind, status },
    redact,
  });
