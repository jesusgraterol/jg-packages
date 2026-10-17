import { createStore, del, get, set, type UseStore } from 'idb-keyval';

import { createMemoryStore } from '../memory-store/index.js';
import {
  INDEXED_DB_DATABASE,
  STORAGE_TEST_DATA,
  assertStoreId,
  buildIndexedDbKey,
  buildUnavailableException,
  parseValue,
  type IAsyncStore,
  type IRecordId,
  type IStoreOptions,
  type ISyncStore,
} from '../shared/index.js';

// IndexedDB, read from globalThis so the store also works in workers. Some environments lack it,
// so it's optional here
const indexedDbGlobals: { indexedDB?: IDBFactory } = globalThis;

// the jg-storage database's records object store, opened on first use, because opening it reads
// the indexedDB global, which some environments lack
let recordsStore: UseStore | undefined;
const getRecordsStore = (): UseStore => {
  recordsStore ??= createStore(INDEXED_DB_DATABASE.name, INDEXED_DB_DATABASE.storeName);
  return recordsStore;
};

/**
 * Probes whether IndexedDB accepts writes, by writing and deleting a record in the jg-storage
 * database. The probe's key is a string, and every data key an array, so they never collide.
 * @returns Whether IndexedDB is available.
 */
const probeIndexedDb = async (): Promise<boolean> => {
  try {
    if (!indexedDbGlobals.indexedDB) {
      return false;
    }
    await set(STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value, getRecordsStore());
    await del(STORAGE_TEST_DATA.key, getRecordsStore());
    return true;
  } catch {
    return false;
  }
};

/**
 * Creates a store over IndexedDB, which works in pages and workers alike. Records live in the
 * `records` object store of the `jg-storage` database, under `[id]` for the root record and
 * `[id, recordId]` for the others. Values are stored with the structured clone algorithm, so dates,
 * maps, and binary data keep their types. IndexedDB is read and probed on the first call, never
 * when the store is created.
 * @param id The store's identifier: letters, digits, underscores, and hyphens.
 * @param options fallback: 'memory' keeps records in memory when IndexedDB is unavailable, and
 * schema validates every stored value get reads.
 * @returns The store.
 * @example
 * import { createIndexedDbStore } from 'jg-storage';
 *
 * const devices = createIndexedDbStore<{ token: string }>('devices');
 * await devices.set('phone', { token: 'abc' }); // stored under the key ['devices', 'phone']
 * await devices.get('phone'); // { token: 'abc' }
 * await devices.del('phone');
 * @throws
 * - INVALID_STORE_ID: The store id must hold only letters, digits, underscores, and hyphens.
 * - STORE_UNAVAILABLE: set or del ran while IndexedDB is unavailable, without a fallback.
 *
 * Errors from IndexedDB itself, such as a value it can't clone, propagate.
 */
export const createIndexedDbStore = <T>(
  id: string,
  options: IStoreOptions<T> = {},
): IAsyncStore<T> => {
  assertStoreId(id);
  let compatibility: Promise<boolean> | undefined;
  let memory: ISyncStore<T> | undefined;

  // the probe runs once, even when several calls start before it settles
  const isCompatible = (): Promise<boolean> => {
    compatibility ??= probeIndexedDb();
    return compatibility;
  };

  // the memory store an unavailable IndexedDB falls back to, when the options ask for one
  const getMemory = (): ISyncStore<T> | undefined => {
    if (options.fallback === 'memory') {
      memory ??= createMemoryStore(id, options);
    }
    return memory;
  };

  return {
    id,
    mechanism: 'indexedDB',
    isCompatible,
    get: async (recordId?: IRecordId) => {
      if (!(await isCompatible())) {
        return getMemory()?.get(recordId);
      }
      const value: unknown = await get(buildIndexedDbKey(id, recordId), getRecordsStore());
      return value === undefined ? undefined : parseValue(value, options);
    },
    set: async (recordId: IRecordId, value: T) => {
      if (await isCompatible()) {
        await set(buildIndexedDbKey(id, recordId), value, getRecordsStore());
        return;
      }
      const fallback = getMemory();
      if (fallback === undefined) {
        throw buildUnavailableException(id, 'indexedDB');
      }
      fallback.set(recordId, value);
    },
    del: async (recordId?: IRecordId) => {
      if (await isCompatible()) {
        await del(buildIndexedDbKey(id, recordId), getRecordsStore());
        return;
      }
      const fallback = getMemory();
      if (fallback === undefined) {
        throw buildUnavailableException(id, 'indexedDB');
      }
      fallback.del(recordId);
    },
  };
};
