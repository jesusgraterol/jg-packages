import type { IQueryExecutionState, IQueryInitialResolutionState } from '../query-state/index.js';

// a query a boundary watches: a useQuery or useInfiniteQuery result, or useSeededInfiniteQuery's
export type IQueryBoundaryQuery = IQueryExecutionState &
  IQueryInitialResolutionState & {
    data: unknown;
    error?: unknown;
    isFetching?: boolean | undefined;
    isRefetching?: boolean | undefined;
    refetch?: (() => unknown) | undefined;
    fetchNextPage?: (() => unknown) | undefined;
  };

// how an error shows: in place of the content, or beside content that's still current
export type IQueryErrorPresentation = 'blocking' | 'retained';

// what useQueryBoundary takes
export type IUseQueryBoundaryOptions<TQuery extends IQueryBoundaryQuery> = {
  // the queries whose data the content shows
  queries: readonly TQuery[];

  // what the content shows, such as a project's id: a new key hides the content until the queries
  // resolve for it
  resolutionKey: string;

  // whether the app already approved this key's data, such as before the boundary remounted, so
  // cached data shows at once. It never brings content back after an access loss
  isInitialResolutionApproved?: boolean | undefined;

  // whether a query's error means the user lost access, such as a 403, which hides the content at
  // once, even approved, until every query succeeds again. Defaults to never
  isAccessDenied?: ((error: unknown) => boolean) | undefined;
};

// what useQueryBoundary returns
export type IQueryBoundaryState<TQuery extends IQueryBoundaryQuery> = {
  // whether to render the content: the key resolved, every query has data, and no access is lost
  canRenderContent: boolean;

  // whether to show a loader in place of the content
  isLoaderVisible: boolean;

  // whether a query failed
  hasError: boolean;

  // whether the error replaces the content, or shows beside content that's still current
  errorPresentation: IQueryErrorPresentation;

  // the queries that failed
  failedQueries: TQuery[];

  // the first query, when it pages and the content renders, for a load-more control
  loadMoreQuery: TQuery | undefined;

  // refetches every failed query, resolving once all of them settle. Its identity never changes
  retryFailed: () => Promise<void>;
};

// whether the boundary showed the content for its key, and whether it then lost access
export type IInitialResolution = {
  key: string;
  isComplete: boolean;
  hasLostAccess: boolean;
};

// what the queries say about the content, read once per render
export type IBoundarySignals = {
  isInitialResolutionApproved: boolean;
  hasAccessLoss: boolean;
  isReadyForInitialDisplay: boolean;
  canConfirmResolution: boolean;
};
