import { createMemoryStore } from '../memory-store/index.js';
import {
  STORAGE_TEST_DATA,
  buildDataKey,
  buildUnavailableException,
  parseJSON,
  parseValue,
  stringifyJSON,
  type IRecordId,
  type IStoreOptions,
  type ISyncStore,
} from '../shared/index.js';

// the web storage mechanisms, read from globalThis when a store first needs them. Workers have
// neither, so they're optional here
type IWebStorageMechanism = 'localStorage' | 'sessionStorage';
const webStorageGlobals: Partial<Record<IWebStorageMechanism, Storage>> = globalThis;

/**
 * Reads a web storage mechanism and probes whether it accepts writes. Reading it can throw, such
 * as when a browser blocks storage for the page.
 * @param mechanism The mechanism.
 * @returns The storage, or undefined when it's missing or rejects writes.
 */
const probeWebStorage = (mechanism: IWebStorageMechanism): Storage | undefined => {
  try {
    const storage = webStorageGlobals[mechanism];
    if (!storage) {
      return undefined;
    }
    storage.setItem(STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value);
    storage.removeItem(STORAGE_TEST_DATA.key);
    return storage;
  } catch {
    return undefined;
  }
};

/**
 * Creates a store over localStorage or sessionStorage. The mechanism is probed on the first call,
 * never when the store is created.
 * @param id The identifier every record key starts with.
 * @param mechanism The mechanism.
 * @param options The store's options.
 * @returns The store.
 */
const createWebStorageStore = <T>(
  id: string,
  mechanism: IWebStorageMechanism,
  options: IStoreOptions<T>,
): ISyncStore<T> => {
  let isProbed = false;
  let storage: Storage | undefined;
  let memory: ISyncStore<T> | undefined;

  // the mechanism, probed on the first call. undefined when it's unavailable
  const getStorage = (): Storage | undefined => {
    if (!isProbed) {
      storage = probeWebStorage(mechanism);
      isProbed = true;
    }
    return storage;
  };

  // the memory store an unavailable mechanism falls back to, when the options ask for one
  const getMemory = (): ISyncStore<T> | undefined => {
    if (options.fallback === 'memory') {
      memory ??= createMemoryStore(id, options);
    }
    return memory;
  };

  return {
    id,
    mechanism,
    isCompatible: () => getStorage() !== undefined,
    get: (recordId?: IRecordId) => {
      const webStorage = getStorage();
      if (webStorage === undefined) {
        return getMemory()?.get(recordId);
      }

      // a missing record reads as null. An empty string isn't JSON, so it reads as missing too
      const data = webStorage.getItem(buildDataKey(id, recordId));
      return data ? parseValue(parseJSON(data), options) : undefined;
    },
    set: (recordId: IRecordId, value: T) => {
      const webStorage = getStorage();
      if (webStorage !== undefined) {
        webStorage.setItem(buildDataKey(id, recordId), stringifyJSON(value));
        return;
      }
      const fallback = getMemory();
      if (fallback === undefined) {
        throw buildUnavailableException(id, mechanism);
      }
      fallback.set(recordId, value);
    },
    del: (recordId?: IRecordId) => {
      const webStorage = getStorage();
      if (webStorage !== undefined) {
        webStorage.removeItem(buildDataKey(id, recordId));
        return;
      }
      const fallback = getMemory();
      if (fallback === undefined) {
        throw buildUnavailableException(id, mechanism);
      }
      fallback.del(recordId);
    },
  };
};

/**
 * Creates a store over localStorage, whose records outlive the page. Values are stored as JSON,
 * under the same keys browser-keyval-stores used, so their records read back unchanged.
 * localStorage is read and probed on the first call, never when the store is created.
 * @param id The identifier every record key starts with.
 * @param options fallback: 'memory' keeps records in memory when localStorage is unavailable, and
 * schema validates every stored value get reads.
 * @returns The store.
 * @example
 * const settings = createLocalStore<{ theme: 'light' | 'dark' }>('settings');
 * settings.set(undefined, { theme: 'dark' }); // stored under the key 'settings'
 * settings.get(); // { theme: 'dark' }
 * settings.set('draft', { theme: 'light' }); // stored under the key 'settings_draft'
 * @throws
 * - FAILED_TO_STRINGIFY_JSON: set received a value JSON can't represent.
 * - FAILED_TO_PARSE_JSON: get read a value that isn't JSON.
 * - STORE_UNAVAILABLE: set or del ran while localStorage is unavailable, without a fallback.
 *
 * Errors from localStorage itself, such as a full quota, propagate.
 */
export const createLocalStore = <T>(id: string, options: IStoreOptions<T> = {}): ISyncStore<T> =>
  createWebStorageStore(id, 'localStorage', options);

/**
 * Creates a store over sessionStorage, whose records last as long as the browser tab. Values are
 * stored as JSON, under the same keys browser-keyval-stores used, so their records read back
 * unchanged. sessionStorage is read and probed on the first call, never when the store is created.
 * @param id The identifier every record key starts with.
 * @param options fallback: 'memory' keeps records in memory when sessionStorage is unavailable,
 * and schema validates every stored value get reads.
 * @returns The store.
 * @example
 * const wizard = createSessionStore<number>('wizard-step', { fallback: 'memory' });
 * wizard.set(undefined, 2);
 * wizard.get(); // 2
 * wizard.del();
 * @throws
 * - FAILED_TO_STRINGIFY_JSON: set received a value JSON can't represent.
 * - FAILED_TO_PARSE_JSON: get read a value that isn't JSON.
 * - STORE_UNAVAILABLE: set or del ran while sessionStorage is unavailable, without a fallback.
 *
 * Errors from sessionStorage itself, such as a full quota, propagate.
 */
export const createSessionStore = <T>(id: string, options: IStoreOptions<T> = {}): ISyncStore<T> =>
  createWebStorageStore(id, 'sessionStorage', options);
