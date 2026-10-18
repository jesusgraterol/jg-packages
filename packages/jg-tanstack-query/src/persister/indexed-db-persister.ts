import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { createStore, del, get, set, type UseStore } from 'idb-keyval';

import type { IIndexedDbPersisterOptions } from './types.js';

/**
 * Checks whether the browser has IndexedDB, which some private windows and older engines lack.
 * @returns Whether it does.
 */
export const isIndexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined';

/**
 * Creates a persister that keeps a TanStack Query client's dehydrated copy in IndexedDB, through
 * idb-keyval. It opens the database on first use, not when it's created, and does nothing where
 * IndexedDB is missing.
 * @param options The database, the store, and the key.
 * @returns The persister.
 * @example
 * import { createIndexedDbPersister } from 'jg-tanstack-query';
 *
 * export const persister = createIndexedDbPersister({
 *   databaseName: 'app-query-cache',
 *   storeName: 'queries',
 *   key: 'query-client',
 * });
 */
export const createIndexedDbPersister = ({
  databaseName,
  storeName,
  key,
}: IIndexedDbPersisterOptions): Persister => {
  let store: UseStore | undefined;
  const openStore = (): UseStore => {
    store ??= createStore(databaseName, storeName);
    return store;
  };

  return {
    persistClient: async (client: PersistedClient): Promise<void> => {
      if (isIndexedDbAvailable()) {
        await set(key, client, openStore());
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> =>
      isIndexedDbAvailable() ? get<PersistedClient>(key, openStore()) : undefined,
    removeClient: async (): Promise<void> => {
      if (isIndexedDbAvailable()) {
        await del(key, openStore());
      }
    },
  };
};
