import { indexedDB } from 'fake-indexeddb';
import { afterEach, expect, test, vi } from 'vitest';

import { createIndexedDbStore } from './indexed-db-store.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

test('shares persisted records between window and service worker contexts', async () => {
  vi.stubGlobal('indexedDB', indexedDB);
  vi.stubGlobal('window', { indexedDB });

  const pageStore = createIndexedDbStore<{ token: string }>('context-share');
  await expect(pageStore.isCompatible()).resolves.toBe(true);
  await pageStore.set('device', { token: 'first-token' });

  vi.stubGlobal('window', undefined);
  const workerStore = createIndexedDbStore<{ token: string }>('context-share');
  await expect(workerStore.isCompatible()).resolves.toBe(true);
  await expect(workerStore.get('device')).resolves.toStrictEqual({ token: 'first-token' });
  await workerStore.set('device', { token: 'second-token' });

  vi.stubGlobal('window', { indexedDB });
  await expect(
    createIndexedDbStore<{ token: string }>('context-share').get('device'),
  ).resolves.toStrictEqual({
    token: 'second-token',
  });

  await pageStore.del('device');
  await expect(pageStore.get('device')).resolves.toBeUndefined();
});

test('keeps structured-clone values, primitives included', async () => {
  vi.stubGlobal('indexedDB', indexedDB);
  const store = createIndexedDbStore<unknown>('structured-clone');
  const values = [new Date(0), new Map([['a', 1]]), new Uint8Array([1, 2, 3]), 'text', 0, null];
  for (const [index, value] of values.entries()) {
    await store.set(index, value);
    await expect(store.get(index)).resolves.toStrictEqual(value);
    await store.del(index);
  }
});
