import type { Persister } from '@tanstack/react-query-persist-client';
import { QueryClient } from '@tanstack/react-query';

import { DEFAULT_QUERY_MAX_AGE_SECONDS } from './constants.js';
import { waitForRestoration } from './restoration.js';
import type { IQueryClientOptions } from './types.js';

// each client's clear in progress, which concurrent calls share
const CLEARS = new WeakMap<QueryClient, Promise<void>>();

/**
 * Creates a TanStack Query client with Moldea's defaults: queries and mutations never retry, a
 * focused window doesn't refetch, and unused data stays in memory as long as it stays persisted.
 * Create it once, outside any component.
 * @param options How long unused data stays in memory.
 * @returns The client.
 * @example
 * import { createQueryClient } from 'jg-query';
 *
 * export const queryClient = createQueryClient();
 */
export const createQueryClient = ({
  maxAgeSeconds = DEFAULT_QUERY_MAX_AGE_SECONDS,
}: IQueryClientOptions = {}): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { gcTime: maxAgeSeconds * 1000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

/**
 * Clears a client's cached data, in memory and persisted, such as at sign-out, so the next person
 * on the device sees none of it. It first waits for the client's restoration from its persisted
 * copy, so restored data can't come back after the clear. Concurrent calls share one clear.
 * @param client The client.
 * @param persister The client's persister.
 * @returns A promise that resolves once the persisted copy is removed too.
 * @example
 * import { clearQueryCache, createIndexedDbPersister, createQueryClient } from 'jg-query';
 *
 * const queryClient = createQueryClient();
 * const persister = createIndexedDbPersister({
 *   databaseName: 'app-query-cache',
 *   storeName: 'queries',
 *   key: 'query-client',
 * });
 *
 * export const signOut = async (): Promise<void> => {
 *   await clearQueryCache(queryClient, persister);
 * };
 * @throws
 * - The persister's own error, when it can't remove the persisted copy, after the memory is cleared.
 */
export const clearQueryCache = (client: QueryClient, persister: Persister): Promise<void> => {
  const inProgress = CLEARS.get(client);
  if (inProgress !== undefined) {
    return inProgress;
  }
  const clear = (async (): Promise<void> => {
    await waitForRestoration(client);
    client.clear();
    await persister.removeClient();
  })();
  CLEARS.set(client, clear);
  // calls share this clear until it settles, so no other can replace it meanwhile
  const forget = (): void => {
    CLEARS.delete(client);
  };
  clear.then(forget, forget);
  return clear;
};
