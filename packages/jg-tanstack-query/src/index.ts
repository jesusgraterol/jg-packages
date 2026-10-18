// types
export type { IQueryClientOptions } from './client/index.js';
export type { IIndexedDbPersisterOptions } from './persister/index.js';
export type { IPersistedQueryProviderProps } from './provider/index.js';

// constants
export { DEFAULT_QUERY_MAX_AGE_SECONDS } from './client/index.js';

// clients
export { clearQueryCache, createQueryClient } from './client/index.js';

// persisters
export { createIndexedDbPersister } from './persister/index.js';

// providers
export { PersistedQueryProvider } from './provider/index.js';
