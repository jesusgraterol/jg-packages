import type { IFetchExceptionInit } from '../fetch-exception/index.js';
import type { IFetchErrorKind } from '../shared/index.js';

// what a failure knows before request adds the method, URL, attempts, and duration
export type IFailureDetails = Omit<
  IFetchExceptionInit,
  'method' | 'url' | 'attempts' | 'durationMs'
> & {
  // whether the attempt's own timeout ran out, which can retry, unlike the whole call's
  isAttemptTimeout?: boolean;
};

/**
 * Thrown inside request to stop the attempt with a known kind of failure; request turns it into
 * the FetchException it returns.
 */
export class RequestFailure extends Error {
  readonly kind: IFetchErrorKind;
  readonly details: IFailureDetails;

  constructor(kind: IFetchErrorKind, details: IFailureDetails = {}) {
    super(details.message ?? kind);
    this.name = 'RequestFailure';
    this.kind = kind;
    this.details = details;
  }
}
