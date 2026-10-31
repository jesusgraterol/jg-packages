import type { IErrorFeedbackResolver } from '../../contracts/index.js';

import type { IQueryErrorAlertQuery, IQueryErrorDetails } from './types.js';

/**
 * Returns the failed queries that should be represented by the alert.
 * @param queries The query results provided by a consuming route or component.
 * @param resolveErrorFeedback The nearest scoped error policy.
 * @returns The subset of queries currently in an error state.
 */
export const getFailedQueries = (
  queries: readonly IQueryErrorAlertQuery[],
  resolveErrorFeedback: IErrorFeedbackResolver,
): IQueryErrorAlertQuery[] =>
  queries.filter((query) => query.isError && !resolveErrorFeedback(query.error).isCancelled);

/**
 * Determines whether a query is already running a retry or fetch operation.
 * @param query The query result to inspect.
 * @returns True when the query reports active fetching work.
 */
export const isQueryFetching = (query: IQueryErrorAlertQuery): boolean =>
  query.isFetching === true || query.isRefetching === true;

/**
 * Resolves safe presentation details without exposing diagnostic messages.
 * @param error The error stored on the failed query.
 * @param resolveErrorFeedback The nearest scoped error policy.
 * @param fallbackMessage Optional authored recovery copy.
 * @returns The normalized error message and optional code.
 */
export const getQueryErrorDetails = (
  error: unknown,
  resolveErrorFeedback: IErrorFeedbackResolver,
  fallbackMessage?: string,
): IQueryErrorDetails => {
  const { code, message } = resolveErrorFeedback(error, { fallbackMessage });
  return { code, message };
};
