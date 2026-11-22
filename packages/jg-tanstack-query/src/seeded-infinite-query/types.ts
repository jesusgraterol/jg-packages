import type { InfiniteData, QueryKey, QueryMeta } from '@tanstack/react-query';

// what useSeededInfiniteQuery takes
export type IUseSeededInfiniteQueryOptions<TPage, TPageParam> = {
  // the key of the query that holds the pages, which no other query may use
  queryKey: QueryKey;

  // the first page, which another query, such as one for a whole screen, already fetched
  firstPage: TPage | undefined;

  // when the first page was fetched, such as that query's dataUpdatedAt. A new value, or a new
  // first page, starts a new generation: the pages loaded so far are dropped
  firstPageUpdatedAt: number;

  // the page param the first page was fetched with
  initialPageParam: TPageParam;

  // gives the next page's param, or undefined or null when there are no more pages
  getNextPageParam: (lastPage: TPage, pages: TPage[]) => TPageParam | undefined | null;

  // fetches every page after the first, aborting when the signal does
  continuationQueryFn: (pageParam: TPageParam, signal: AbortSignal) => Promise<TPage>;

  // the seconds the pages stay cached once no component uses them. Defaults to 0
  gcTimeSeconds?: number | undefined;

  // the most pages kept, dropping the oldest ones
  maxPages?: number | undefined;

  // the query's meta, always with `persist: false`, so the pages are never persisted
  meta?: QueryMeta | undefined;
};

/*
 * What useSeededInfiniteQuery returns: a subset of TanStack's infinite query result, shaped so
 * query boundaries and load-more controls read it like any other query. Until the current
 * generation is published, it's loading, with no data. fetchNextPage and refetch keep their
 * identity across renders.
 */
export type ISeededInfiniteQueryResult<TPage, TPageParam> = {
  // the pages, once the current generation is published
  data: InfiniteData<TPage, TPageParam> | undefined;

  // the error of the last continuation that failed, or null
  error: Error | null;

  // fetches the next page, when there is one and none is being fetched
  fetchNextPage: () => Promise<unknown>;

  // whether there's another page
  hasNextPage: boolean;

  // whether the last continuation failed
  isError: boolean;

  // whether the current generation is published, which a boundary reads as fetched after mount
  isFetchedAfterMount: boolean;

  // whether a continuation is in flight
  isFetching: boolean;

  // whether a continuation is in flight
  isFetchingNextPage: boolean;

  // whether the current generation isn't published yet
  isLoading: boolean;

  // whether the current generation isn't published yet
  isPending: boolean;

  // whether the current generation is published
  isReady: boolean;

  // whether a continuation is in flight
  isRefetching: boolean;

  // always false: the first page is as fresh as the query it came from
  isStale: boolean;

  // whether the current generation is published, with its data
  isSuccess: boolean;

  // fetches the failed continuation again, after an error
  refetch: () => Promise<unknown>;
};

// one publication of a first page into the cache, shared by every component using the same key
export type IProjectionPublication = {
  firstPageUpdatedAt: number;
  firstPage: unknown;
  promise: Promise<boolean>;
  token: symbol;
};

// what fetchNextPage and refetch read from the latest committed render
export type IFetchState = {
  canFetchNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  isFetchNextPageError: boolean;
};
