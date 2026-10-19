import type { QueryClient } from '@tanstack/react-query';

import type { IFetchState, IProjectionPublication } from './types.js';

// the fetch state before the first commit and after an unmount, which fetches nothing
export const EMPTY_FETCH_STATE: IFetchState = {
  canFetchNextPage: false,
  fetchNextPage: () => Promise.resolve(undefined),
  isFetchNextPageError: false,
};

// each client's publications, by query hash, so components sharing a key share a generation
const PUBLICATIONS = new WeakMap<QueryClient, Map<string, IProjectionPublication>>();

/**
 * Gives a client's publications, by query hash, creating them on first use and forgetting a
 * query's publication when the cache removes the query, so a later mount publishes it again.
 * @param queryClient The client.
 * @returns The publications.
 */
export const getPublications = (queryClient: QueryClient): Map<string, IProjectionPublication> => {
  const existing = PUBLICATIONS.get(queryClient);
  if (existing !== undefined) {
    return existing;
  }
  const publications = new Map<string, IProjectionPublication>();
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'removed') {
      publications.delete(event.query.queryHash);
    }
  });
  PUBLICATIONS.set(queryClient, publications);
  return publications;
};
