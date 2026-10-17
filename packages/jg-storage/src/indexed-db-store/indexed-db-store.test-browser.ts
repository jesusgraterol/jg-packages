import { afterEach, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createIndexedDbStore } from './indexed-db-store.js';

/*
 * The IndexedDB store against the browser's own IndexedDB, in Chromium, Firefox, and WebKit.
 */

/**
 * Reads every key in the jg-storage database's records store, straight from IndexedDB.
 * @returns A promise that resolves to the keys.
 */
const readKeys = async (): Promise<IDBValidKey[]> => {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('jg-storage');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB failed.'));
  });
  try {
    const request = database.transaction('records', 'readonly').objectStore('records').getAllKeys();
    return await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB failed.'));
    });
  } finally {
    database.close();
  }
};

// stores whose records each test removes afterwards
const stores: ReturnType<typeof createIndexedDbStore>[] = [];
const createStore = <T>(id: string, options?: Parameters<typeof createIndexedDbStore<T>>[1]) => {
  const store = createIndexedDbStore<T>(id, options);
  stores.push(store);
  return store;
};

afterEach(async () => {
  for (const store of stores.splice(0)) {
    for (const recordId of [undefined, 1, 'a', 'probe']) {
      await store.del(recordId);
    }
  }
});

describe('an IndexedDB store', () => {
  test("keeps structured-clone values in the jg-storage database's records store", async () => {
    const store = createStore<unknown>('clone');
    const values = [new Date(0), new Map([['a', 1]]), new Uint8Array([1, 2, 3]), 'text', 0, null];

    await expect(store.isCompatible()).resolves.toBe(true);
    for (const value of values) {
      await store.set('a', value);
      await expect(store.get('a')).resolves.toStrictEqual(value);
    }
    expect(await readKeys()).toContainEqual(['clone', 'a']);
  });

  test('reaches the same record with 1 and "1", under [storeId, "1"]', async () => {
    const store = createStore<string>('ids');
    await store.set(1, 'one');

    await expect(store.get('1')).resolves.toBe('one');
    expect(await readKeys()).toContainEqual(['ids', '1']);
    expect(await readKeys()).not.toContain('jg-storage-probe');
  });

  test('keeps the records of a store named probe through probes', async () => {
    const probe = createStore<string>('probe');
    await probe.set(undefined, 'root');

    await expect(createStore('fresh').isCompatible()).resolves.toBe(true);
    await expect(probe.get()).resolves.toBe('root');
  });

  test('shares records between stores with the same id, and validates them with a schema', async () => {
    await createStore<{ theme: string }>('shared').set(undefined, { theme: 'dark' });
    const validated = createStore('shared', {
      schema: z.object({ theme: z.enum(['light', 'dark']) }),
    });

    await expect(validated.get()).resolves.toStrictEqual({ theme: 'dark' });
    await createStore<unknown>('shared').set(undefined, { theme: 'blue' });
    await expect(validated.get()).rejects.toBeInstanceOf(z.ZodError);
  });
});
