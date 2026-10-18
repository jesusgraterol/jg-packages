import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import type { ReactElement } from 'react';

import { DEFAULT_QUERY_MAX_AGE_SECONDS } from '../client/constants.js';
import { trackRestoration } from '../client/restoration.js';
import { isIndexedDbAvailable } from '../persister/indexed-db-persister.js';
import type { IPersistedQueryProviderProps } from './types.js';
import { shouldPersistMutation, shouldPersistQuery } from './utilities.js';

/**
 * Provides a TanStack Query client that restores its persisted copy on start, and persists the
 * queries that opt in with `meta: { persist: true }`, never mutations. Where IndexedDB is
 * missing, it provides the client without persistence.
 * @param props The client, its persister, the copy's version, its maximum age, and the app.
 * @returns The provider.
 * @example
 * import { createElement } from 'react';
 * import { createIndexedDbPersister, createQueryClient, PersistedQueryProvider } from 'jg-query';
 *
 * declare const App: () => null;
 *
 * const client = createQueryClient();
 * const persister = createIndexedDbPersister({
 *   databaseName: 'app-query-cache',
 *   storeName: 'queries',
 *   key: 'query-client',
 * });
 *
 * export const Root = () =>
 *   createElement(PersistedQueryProvider, { client, persister, buster: 'v1' }, createElement(App));
 */
export const PersistedQueryProvider = ({
  client,
  persister,
  buster,
  maxAgeSeconds = DEFAULT_QUERY_MAX_AGE_SECONDS,
  children,
}: IPersistedQueryProviderProps): ReactElement => {
  if (!isIndexedDbAvailable()) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const restoration = trackRestoration(client);
  return (
    <PersistQueryClientProvider
      client={client}
      onSuccess={restoration.finish}
      onError={restoration.finish}
      persistOptions={{
        persister,
        buster,
        maxAge: maxAgeSeconds * 1000,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
          shouldDehydrateMutation: shouldPersistMutation,
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
};
