import type { ILoadMoreButtonQuery } from '../load-more-button/index.js';

import type { IQueryBoundaryQuery } from './types.js';

// first-query pagination support controls the optional LoadMoreButton slot.
type IQueryBoundaryPaginationQuery = IQueryBoundaryQuery & ILoadMoreButtonQuery;

/**
 * Determines whether a query can be passed to LoadMoreButton.
 * @param query The first query provided to QueryBoundary.
 * @returns True when the query exposes the fetchNextPage contract.
 */
export const isQueryBoundaryPaginationQuery = (
  query: IQueryBoundaryQuery | undefined,
): query is IQueryBoundaryPaginationQuery => typeof query?.fetchNextPage === 'function';
