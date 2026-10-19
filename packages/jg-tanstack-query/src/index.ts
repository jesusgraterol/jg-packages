// types
export type { IQueryClientOptions } from './client/index.js';
export type { IIndexedDbPersisterOptions } from './persister/index.js';
export type { IPersistedQueryProviderProps } from './provider/index.js';
export type {
  IQueryBoundaryQuery,
  IQueryBoundaryState,
  IQueryErrorPresentation,
  IUseQueryBoundaryOptions,
} from './query-boundary/index.js';
export type { IQueryExecutionState, IQueryInitialResolutionState } from './query-state/index.js';
export type {
  ISeededInfiniteQueryResult,
  IUseSeededInfiniteQueryOptions,
} from './seeded-infinite-query/index.js';

// constants
export { DEFAULT_QUERY_MAX_AGE_SECONDS } from './client/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// clients
export { clearQueryCache, createQueryClient } from './client/index.js';

// persisters
export { createIndexedDbPersister } from './persister/index.js';

// providers
export { PersistedQueryProvider } from './provider/index.js';

// seeded infinite queries
export { useSeededInfiniteQuery } from './seeded-infinite-query/index.js';

// query state
export {
  canQueryLoadMore,
  isQueryLoading,
  isQueryLoadingMore,
  isQueryReadyForInitialDisplay,
  isQueryResultDataAvailable,
} from './query-state/index.js';

// query boundaries
export { useQueryBoundary } from './query-boundary/index.js';
