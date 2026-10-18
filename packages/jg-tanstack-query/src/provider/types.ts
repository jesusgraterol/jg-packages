import type { QueryClient } from '@tanstack/react-query';
import type { Persister } from '@tanstack/react-query-persist-client';
import type { ReactNode } from 'react';

// what PersistedQueryProvider takes
export type IPersistedQueryProviderProps = {
  // the client, from createQueryClient
  client: QueryClient;

  // where the client's persisted copy lives, from createIndexedDbPersister
  persister: Persister;

  // the persisted copy's version: change it to throw away copies an older release wrote
  buster: string;

  // how long a persisted copy stays usable, which the client's maxAgeSeconds must be at least.
  // Defaults to DEFAULT_QUERY_MAX_AGE_SECONDS
  maxAgeSeconds?: number;

  children?: ReactNode;
};
