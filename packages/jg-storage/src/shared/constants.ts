// the namespace every web storage key starts with: `jg-storage:<storeId>` for a store's root record,
// and `jg-storage:<storeId>:<recordId>` for the others
export const KEY_NAMESPACE = 'jg-storage';

// the characters a store id may hold. A colon never appears in one, so keys can't collide
export const STORE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/*
 * The record written and removed to probe whether a mechanism accepts writes. Every data key starts
 * with `jg-storage:` and a non-empty store id, so the probe can never touch a store's records, even
 * those of a store named `probe`.
 */
export const STORAGE_TEST_DATA = {
  key: 'jg-storage-probe',
  value: 'probe',
} as const;

// the IndexedDB database every IndexedDB store keeps its records in, and its object store
export const INDEXED_DB_DATABASE = {
  name: 'jg-storage',
  storeName: 'records',
} as const;
