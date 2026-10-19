# Changelog

## 0.2.0

### Added

- `useSeededInfiniteQuery(options)`, which pages through a list whose first page another query already fetched, publishing that page into an infinite query and fetching only the pages after it with `continuationQueryFn`. A new `firstPageUpdatedAt` or first page starts a new generation, aborting a page in flight, and components using the same key share one. Its `fetchNextPage` and `refetch` keep their identity, and a fetch forced before the first page arrives rejects with `FIRST_PAGE_NOT_READY`.
- `isQueryLoading`, `isQueryReadyForInitialDisplay`, `canQueryLoadMore`, `isQueryLoadingMore`, and `isQueryResultDataAvailable`, which read a query's flags.
- `useQueryBoundary(options)`, which decides, without rendering, whether a screen shows its content, a loader, or an error for the queries it needs: content waits for data that's fresh or fetched after mount for the `resolutionKey`, stays through refetches and background errors, and hides in the same render as a key change or an error `isAccessDenied` recognizes. It returns the failed queries, the first query for a load-more control, and a stable `retryFailed`.
- `ERRORS`, `IUseSeededInfiniteQueryOptions`, `ISeededInfiniteQueryResult`, `IQueryExecutionState`, `IQueryInitialResolutionState`, `IQueryBoundaryQuery`, `IUseQueryBoundaryOptions`, `IQueryBoundaryState`, and `IQueryErrorPresentation`.
- A recipe for an unstyled query boundary component.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `createQueryClient`, a TanStack Query client that never retries, doesn't refetch on window focus, and keeps unused data for `DEFAULT_QUERY_MAX_AGE_SECONDS`, 10 days.
- `createIndexedDbPersister`, which keeps a client's persisted copy in IndexedDB, opening it on first use.
- `PersistedQueryProvider`, which restores the persisted copy and saves only the queries that opt in with `meta: { persist: true }`, never mutations, and provides the client without persistence where IndexedDB is missing.
- `clearQueryCache`, which waits for the client's restoration, then clears its memory and its persisted copy.
