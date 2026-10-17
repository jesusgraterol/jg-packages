import {
  buildDataKey,
  parseValue,
  type IRecordId,
  type IStoreOptions,
  type ISyncStore,
} from '../shared/index.js';

/**
 * Creates a store that keeps its records in memory for as long as the store exists. Values are
 * kept as they are, without serializing them, and the store is always available.
 * @param id The identifier every record key starts with.
 * @param options parse runs on every stored value get reads. fallback has no effect, because
 * memory is always available.
 * @returns The store.
 * @example
 * const drafts = createMemoryStore<{ text: string }>('drafts');
 * drafts.set('post-1', { text: 'Hello' });
 * drafts.get('post-1'); // { text: 'Hello' }
 * drafts.del('post-1');
 * drafts.get('post-1'); // undefined
 */
export const createMemoryStore = <T>(id: string, options: IStoreOptions<T> = {}): ISyncStore<T> => {
  const records = new Map<string, T>();
  return {
    id,
    mechanism: 'tempMemory',
    isCompatible: () => true,
    get: (recordId?: IRecordId) => {
      const value = records.get(buildDataKey(id, recordId));
      return value === undefined ? undefined : parseValue(value, options);
    },
    set: (recordId: IRecordId, value: T) => {
      records.set(buildDataKey(id, recordId), value);
    },
    del: (recordId?: IRecordId) => {
      records.delete(buildDataKey(id, recordId));
    },
  };
};
