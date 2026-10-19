import type { IQueryExecutionState, IQueryInitialResolutionState } from './types.js';

/**
 * Checks whether a query is loading: it has no data yet, or is fetching its first.
 * @param query The query's state, such as a useQuery result.
 * @returns Whether it's loading or pending.
 * @example
 * import { isQueryLoading } from 'jg-tanstack-query';
 *
 * isQueryLoading({ isError: false, isPending: true }); // true
 */
export const isQueryLoading = (query: IQueryExecutionState): boolean =>
  query.isLoading === true || query.isPending === true;

/**
 * Checks whether a query's data can be shown when a screen first renders: it didn't fail, and its
 * data is fresh, or was fetched since the component mounted. Stale data from the cache waits for
 * the refetch, so a screen never shows data from a previous visit as current.
 * @param query The query's state, such as a useQuery result.
 * @returns Whether its data is fit for the first display.
 * @example
 * import { isQueryReadyForInitialDisplay } from 'jg-tanstack-query';
 *
 * isQueryReadyForInitialDisplay({ isError: false, isStale: true, isFetchedAfterMount: false }); // false
 */
export const isQueryReadyForInitialDisplay = (query: IQueryInitialResolutionState): boolean =>
  !query.isError && (!query.isStale || query.isFetchedAfterMount);

/**
 * Checks whether an infinite query has another page to load, and isn't failing.
 * @param query The query's state, such as a useInfiniteQuery result.
 * @returns Whether another page can be requested.
 * @example
 * import { canQueryLoadMore } from 'jg-tanstack-query';
 *
 * canQueryLoadMore({ isError: false, hasNextPage: true }); // true
 */
export const canQueryLoadMore = (query: IQueryExecutionState): boolean =>
  !query.isError && query.hasNextPage === true;

/**
 * Checks whether an infinite query is fetching its next page.
 * @param query The query's state, such as a useInfiniteQuery result.
 * @returns Whether a next page is in flight.
 * @example
 * import { isQueryLoadingMore } from 'jg-tanstack-query';
 *
 * isQueryLoadingMore({ isError: false, isFetchingNextPage: true }); // true
 */
export const isQueryLoadingMore = (query: IQueryExecutionState): boolean =>
  query.isFetchingNextPage === true;

/**
 * Checks whether every query has data to show: none failed, and none is loading.
 * @param queries The queries' states.
 * @returns Whether all of them have data.
 * @example
 * import { isQueryResultDataAvailable } from 'jg-tanstack-query';
 *
 * isQueryResultDataAvailable([{ isError: false }, { isError: false, isPending: true }]); // false
 */
export const isQueryResultDataAvailable = (queries: readonly IQueryExecutionState[]): boolean =>
  queries.every((query) => !query.isError && !isQueryLoading(query));
