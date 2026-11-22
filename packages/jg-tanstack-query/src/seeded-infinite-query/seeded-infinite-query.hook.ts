import {
  hashKey,
  type InfiniteData,
  type QueryKey,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type {
  IFetchState,
  ISeededInfiniteQueryResult,
  IUseSeededInfiniteQueryOptions,
} from './types.js';
import { EMPTY_FETCH_STATE, getPublications } from './utilities.js';

/**
 * Pages through a list whose first page another query already fetched, such as one that loads a
 * whole screen, without fetching that page again. The first page is published into an infinite
 * query under `queryKey`, and `continuationQueryFn` fetches only the pages after it.
 *
 * Each `firstPageUpdatedAt` and first page form a generation. A new generation cancels any page in
 * flight and starts over from the new first page, and an older publication that finishes late
 * never replaces a newer one. Components that use the same key share one generation and its
 * pages, so one unmounting aborts nothing. Until the current generation is published, the result
 * is loading, with no data. The query never fetches by itself and is never persisted.
 * @param options The key, the first page and when it was fetched, how to fetch the pages after
 * it, and the cache settings.
 * @returns A query result for boundaries and load-more controls, whose fetchNextPage and refetch
 * keep their identity.
 * @example
 * import { useQuery } from '@tanstack/react-query';
 * import { useSeededInfiniteQuery } from 'jg-tanstack-query';
 *
 * type IPage = { items: string[]; nextCursor: string | null };
 * declare const fetchScreen: () => Promise<{ activity: IPage }>;
 * declare const fetchActivity: (cursor: string, signal: AbortSignal) => Promise<IPage>;
 *
 * export const useActivity = () => {
 *   const screen = useQuery({ queryKey: ['dashboard'], queryFn: fetchScreen });
 *   return useSeededInfiniteQuery<IPage, string | null>({
 *     queryKey: ['dashboard', 'activity'],
 *     firstPage: screen.data?.activity,
 *     firstPageUpdatedAt: screen.dataUpdatedAt,
 *     initialPageParam: null,
 *     getNextPageParam: (page) => page.nextCursor,
 *     continuationQueryFn: (cursor, signal) => fetchActivity(cursor as string, signal),
 *   });
 * };
 * @throws
 * - FIRST_PAGE_NOT_READY: The first page isn't ready yet.
 */
export const useSeededInfiniteQuery = <TPage, TPageParam>({
  queryKey,
  firstPage,
  firstPageUpdatedAt,
  initialPageParam,
  getNextPageParam,
  continuationQueryFn,
  gcTimeSeconds = 0,
  maxPages,
  meta,
}: IUseSeededInfiniteQueryOptions<TPage, TPageParam>): ISeededInfiniteQueryResult<
  TPage,
  TPageParam
> => {
  const queryClient = useQueryClient();
  const queryKeyHash = hashKey(queryKey);
  // a key equal to the given one, kept while its hash is the same, so an inline array is stable
  const stableQueryKey = useMemo(() => JSON.parse(queryKeyHash) as QueryKey, [queryKeyHash]);
  const queryHash = queryClient.defaultQueryOptions({ queryKey: stableQueryKey }).queryHash;
  const publicationSequence = useRef(0);
  const [publishedGeneration, setPublishedGeneration] = useState<{
    firstPageUpdatedAt: number;
    firstPage: TPage;
    queryKeyHash: string;
  } | null>(null);

  const projectionQuery = useInfiniteQuery<
    TPage,
    Error,
    InfiniteData<TPage, TPageParam>,
    QueryKey,
    TPageParam
  >({
    queryKey: stableQueryKey,
    initialPageParam,
    enabled: false,
    gcTime: gcTimeSeconds * 1000,
    ...(maxPages === undefined ? {} : { maxPages }),
    staleTime: Infinity,
    meta: { ...meta, persist: false },
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    queryFn: ({ pageParam, signal }) => {
      if (Object.is(pageParam, initialPageParam)) {
        // the first page is only ever published, so this runs only when something forces a fetch
        return firstPage === undefined
          ? Promise.reject(
              new Exception("The first page isn't ready yet.", {
                code: ERRORS.FIRST_PAGE_NOT_READY,
              }),
            )
          : Promise.resolve(firstPage);
      }
      return continuationQueryFn(pageParam as TPageParam, signal);
    },
    getNextPageParam,
  });

  const isReady =
    firstPage !== undefined &&
    firstPageUpdatedAt > 0 &&
    publishedGeneration?.queryKeyHash === queryKeyHash &&
    publishedGeneration.firstPageUpdatedAt === firstPageUpdatedAt &&
    Object.is(publishedGeneration.firstPage, firstPage);

  useEffect(() => {
    publicationSequence.current += 1;
    const publicationId = publicationSequence.current;
    if (firstPage === undefined || firstPageUpdatedAt <= 0) {
      return undefined;
    }
    const publications = getPublications(queryClient);
    let publication = publications.get(queryHash);
    if (
      publication === undefined ||
      publication.firstPageUpdatedAt !== firstPageUpdatedAt ||
      !Object.is(publication.firstPage, firstPage)
    ) {
      const token = Symbol(queryHash);
      const promise = (async (): Promise<boolean> => {
        // aborts a continuation of the previous generation, so its page never lands on this one
        await queryClient.cancelQueries({ queryKey: stableQueryKey, exact: true });
        if (publications.get(queryHash)?.token !== token) {
          return false;
        }
        queryClient.setQueryData<InfiniteData<TPage, TPageParam>>(stableQueryKey, {
          pages: [firstPage],
          pageParams: [initialPageParam],
        });
        return true;
      })();
      publication = { firstPageUpdatedAt, firstPage, promise, token };
      publications.set(queryHash, publication);
    }
    void publication.promise.then((isPublished) => {
      if (isPublished && publicationSequence.current === publicationId) {
        setPublishedGeneration({ firstPageUpdatedAt, firstPage, queryKeyHash });
      }
    });
    return () => {
      if (publicationSequence.current === publicationId) {
        publicationSequence.current += 1;
      }
    };
  }, [
    firstPage,
    firstPageUpdatedAt,
    initialPageParam,
    queryClient,
    queryHash,
    queryKeyHash,
    stableQueryKey,
  ]);

  const fetchStateRef = useRef<IFetchState>(EMPTY_FETCH_STATE);
  useLayoutEffect(() => {
    const fetchState: IFetchState = {
      canFetchNextPage:
        isReady && projectionQuery.hasNextPage && !projectionQuery.isFetchingNextPage,
      fetchNextPage: projectionQuery.fetchNextPage,
      isFetchNextPageError: isReady && projectionQuery.isFetchNextPageError,
    };
    fetchStateRef.current = fetchState;
    return () => {
      if (fetchStateRef.current === fetchState) {
        fetchStateRef.current = EMPTY_FETCH_STATE;
      }
    };
  }, [
    isReady,
    projectionQuery.fetchNextPage,
    projectionQuery.hasNextPage,
    projectionQuery.isFetchNextPageError,
    projectionQuery.isFetchingNextPage,
  ]);

  const fetchNextPage = useCallback((): Promise<unknown> => {
    const current = fetchStateRef.current;
    return current.canFetchNextPage ? current.fetchNextPage() : Promise.resolve(undefined);
  }, []);

  const refetch = useCallback((): Promise<unknown> => {
    const current = fetchStateRef.current;
    // refetching the whole infinite query would fetch the first page, so retry only the failed one
    return current.isFetchNextPageError ? current.fetchNextPage() : Promise.resolve(undefined);
  }, []);

  const isError = isReady && projectionQuery.isFetchNextPageError;
  const isFetchingNextPage = isReady && projectionQuery.isFetchingNextPage;
  const data = isReady ? projectionQuery.data : undefined;
  const hasNextPage = isReady && projectionQuery.hasNextPage;
  const error = isError ? projectionQuery.error : null;

  return useMemo(
    () => ({
      data,
      error,
      fetchNextPage,
      hasNextPage,
      isError,
      isFetchedAfterMount: isReady,
      isFetching: isFetchingNextPage,
      isFetchingNextPage,
      isLoading: !isReady,
      isPending: !isReady,
      isReady,
      isRefetching: isFetchingNextPage,
      isStale: false,
      isSuccess: isReady && data !== undefined,
      refetch,
    }),
    [data, error, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isReady, refetch],
  );
};
