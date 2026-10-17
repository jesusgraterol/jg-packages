import { indexedDB } from 'fake-indexeddb';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createIndexedDbStore } from './indexed-db-store/index.js';
import { createMemoryStore } from './memory-store/index.js';
import { ERRORS } from './shared/index.js';
import { createFakeStorage } from './shared/storage.test-utils.js';
import { createLocalStore, createSessionStore } from './web-storage-store/index.js';

/*
 * jg-storage's own layout: validated store ids, record ids as strings, `jg-storage:` keys in web
 * storage, and the `jg-storage` IndexedDB database, with a probe that never touches a record.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Reads every key and value in the jg-storage database's records store, straight from IndexedDB.
 * @returns A promise that resolves to the records, in key order.
 */
const readIndexedDbRecords = async (): Promise<[IDBValidKey, unknown][]> => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('jg-storage');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('The IndexedDB request failed.'));
  });
  try {
    const store = database.transaction('records', 'readonly').objectStore('records');
    const [keys, values] = await Promise.all(
      [store.getAllKeys(), store.getAll()].map(
        (request) =>
          new Promise<unknown[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result as unknown[]);
            request.onerror = () =>
              reject(request.error ?? new Error('The IndexedDB request failed.'));
          }),
      ),
    );
    return (keys as IDBValidKey[]).map((key, index) => [key, values?.[index]]);
  } finally {
    database.close();
  }
};

describe('store ids', () => {
  test.each(['', 'a:b', 'a b', 'ä', 'a/b', 'jg-storage:settings'])(
    'every factory rejects %o with INVALID_STORE_ID',
    (storeId) => {
      expectToThrowCode(() => createMemoryStore(storeId), ERRORS.INVALID_STORE_ID);
      expectToThrowCode(() => createLocalStore(storeId), ERRORS.INVALID_STORE_ID);
      expectToThrowCode(() => createSessionStore(storeId), ERRORS.INVALID_STORE_ID);
      expectToThrowCode(() => createIndexedDbStore(storeId), ERRORS.INVALID_STORE_ID);
    },
  );
});

describe('web storage keys', () => {
  test('are jg-storage:<storeId> and jg-storage:<storeId>:<recordId>, and the probe leaves none', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore<string>('settings');

    store.set(undefined, 'root');
    store.set('draft', 'record');
    store.set(7, 'numbered');

    expect(
      Array.from({ length: storage.length }, (_, index) => storage.key(index)).sort(),
    ).toStrictEqual(['jg-storage:settings', 'jg-storage:settings:7', 'jg-storage:settings:draft']);
  });
});

describe('record ids', () => {
  test.each([
    ['memory', () => createMemoryStore<string>('ids')],
    [
      'localStorage',
      () => {
        vi.stubGlobal('localStorage', createFakeStorage());
        return createLocalStore<string>('ids');
      },
    ],
    [
      'sessionStorage',
      () => {
        vi.stubGlobal('sessionStorage', createFakeStorage());
        return createSessionStore<string>('ids');
      },
    ],
  ] as const)('1 and "1" reach the same record in %s', (_, create) => {
    const store = create();
    store.set(1, 'one');

    expect(store.get('1')).toBe('one');
    store.set('1', 'uno');
    expect(store.get(1)).toBe('uno');
    store.del(1);
    expect(store.get('1')).toBeUndefined();
  });

  test('1 and "1" reach the same record in IndexedDB, keyed [storeId, "1"]', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    const store = createIndexedDbStore<string>('ids');
    await store.set(1, 'one');

    await expect(store.get('1')).resolves.toBe('one');
    await store.set('1', 'uno');
    await expect(store.get(1)).resolves.toBe('uno');
    expect(await readIndexedDbRecords()).toContainEqual([['ids', '1'], 'uno']);
    await store.del(1);
    await expect(store.get('1')).resolves.toBeUndefined();
  });
});

describe('the availability probe', () => {
  test('never touches the records of a store named probe in web storage', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const probe = createLocalStore<string>('probe');
    probe.set(undefined, 'root');
    probe.set('probe', 'record');

    // each new store probes the storage on its first call
    expect(createLocalStore('settings').isCompatible()).toBe(true);
    expect(createLocalStore('probe').isCompatible()).toBe(true);

    expect(probe.get()).toBe('root');
    expect(probe.get('probe')).toBe('record');
    expect(storage.getItem('jg-storage-probe')).toBeNull();
  });

  test('never touches the records of a store named probe in IndexedDB', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    const probe = createIndexedDbStore<string>('probe');
    await probe.set(undefined, 'root');
    await probe.set('probe', 'record');

    await expect(createIndexedDbStore('settings').isCompatible()).resolves.toBe(true);

    await expect(probe.get()).resolves.toBe('root');
    await expect(probe.get('probe')).resolves.toBe('record');
    const keys = (await readIndexedDbRecords()).map(([key]) => key);
    expect(keys).toContainEqual(['probe']);
    expect(keys).toContainEqual(['probe', 'probe']);
    expect(keys).not.toContain('jg-storage-probe');
  });
});
