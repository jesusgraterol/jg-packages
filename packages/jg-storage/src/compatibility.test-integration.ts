import { IndexedDBStore, LocalStorageStore, SessionStorageStore } from 'browser-keyval-stores';
import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { createIndexedDbStore, createLocalStore, createSessionStore } from './index.js';
import { createFakeStorage } from './shared/storage.test-utils.js';

// records written by browser-keyval-stores 1.1.1, the package jg-storage replaces
const ROOT_RECORD = { theme: 'dark', fontSize: 14 };
const RECORDS: [string | number, { id: number; tags: string[] }][] = [
  ['16ceb975-4989-4c86-8b63-99294e86a13d', { id: 1, tags: ['a'] }],
  [655643215461, { id: 2, tags: [] }],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('records written by browser-keyval-stores', () => {
  test('read back unchanged from localStorage and sessionStorage', () => {
    // the old stores read window, and the new ones read globalThis
    const localStorage = createFakeStorage();
    const sessionStorage = createFakeStorage();
    vi.stubGlobal('window', { localStorage, sessionStorage });
    vi.stubGlobal('localStorage', localStorage);
    vi.stubGlobal('sessionStorage', sessionStorage);

    const oldLocal = new LocalStorageStore<object>('settings');
    const oldSession = new SessionStorageStore<object>('session');
    oldLocal.set(undefined, ROOT_RECORD);
    oldSession.set(undefined, ROOT_RECORD);
    for (const [recordId, value] of RECORDS) {
      oldLocal.set(recordId, value);
      oldSession.set(recordId, value);
    }

    const newLocal = createLocalStore<object>('settings');
    const newSession = createSessionStore<object>('session');
    expect(newLocal.get()).toStrictEqual(ROOT_RECORD);
    expect(newSession.get()).toStrictEqual(ROOT_RECORD);
    for (const [recordId, value] of RECORDS) {
      expect(newLocal.get(recordId)).toStrictEqual(value);
      expect(newSession.get(recordId)).toStrictEqual(value);
    }

    // records written by the new stores read back through the old ones, too
    newLocal.set('new', { id: 3, tags: ['b'] });
    expect(oldLocal.get('new')).toStrictEqual({ id: 3, tags: ['b'] });
    newLocal.del('new');
    expect(oldLocal.get('new')).toBeUndefined();

    // the probe record never stays behind
    expect(localStorage.length).toBe(1 + RECORDS.length);
    expect(sessionStorage.length).toBe(1 + RECORDS.length);
  });

  test('read back unchanged from IndexedDB', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    vi.stubGlobal('window', { indexedDB });

    const oldStore = new IndexedDBStore<object>('legacy');
    await oldStore.set(undefined, ROOT_RECORD);
    for (const [recordId, value] of RECORDS) {
      await oldStore.set(recordId, value);
    }

    const newStore = createIndexedDbStore<object>('legacy');
    await expect(newStore.get()).resolves.toStrictEqual(ROOT_RECORD);
    for (const [recordId, value] of RECORDS) {
      await expect(newStore.get(recordId)).resolves.toStrictEqual(value);
    }

    // records written by the new store read back through the old one, too
    await newStore.set('new', { id: 3, tags: ['b'] });
    await expect(oldStore.get('new')).resolves.toStrictEqual({ id: 3, tags: ['b'] });

    for (const recordId of [undefined, 'new', ...RECORDS.map(([id]) => id)]) {
      await newStore.del(recordId);
      await expect(oldStore.get(recordId)).resolves.toBeUndefined();
    }
  });
});
