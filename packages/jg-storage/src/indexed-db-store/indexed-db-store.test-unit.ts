import { del, get, set } from 'idb-keyval';
import { expectToRejectCode } from 'jg-exception/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS, STORAGE_TEST_DATA, buildDataKey } from '../shared/index.js';
import { createIndexedDbStore } from './indexed-db-store.js';

// mocks the entire idb-keyval module
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

// makes every write fail, so the compatibility probe fails
const mockSet = (): void => {
  vi.mocked(set).mockRejectedValue(new Error('Error setting data'));
};

describe('createIndexedDbStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  test('it can interact with the Browser IndexedDB API when compatible', async () => {
    vi.stubGlobal('indexedDB', {});
    const storeId = 'unit-test';
    const recordId = undefined;
    const updateData = { hello: 'World!' };
    const store = createIndexedDbStore(storeId);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(store.id).toBe(storeId);
    expect(store.mechanism).toBe('indexedDB');
    await expect(store.get(recordId)).resolves.toBeUndefined();
    expect(get).toHaveBeenNthCalledWith(1, buildDataKey(storeId, recordId));

    // the first set and del calls probe the compatibility
    expect(set).toHaveBeenNthCalledWith(1, STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value);
    await store.set(recordId, updateData);
    expect(set).toHaveBeenNthCalledWith(2, buildDataKey(storeId, recordId), updateData);
    await store.del();
    expect(del).toHaveBeenNthCalledWith(2, buildDataKey(storeId, recordId));
  });

  test('it uses IndexedDB in a service worker without a window', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('indexedDB', {});
    const store = createIndexedDbStore('worker-test');

    await expect(store.isCompatible()).resolves.toBe(true);
    await store.set('device', { token: 'test-token' });

    expect(set).toHaveBeenCalledWith(buildDataKey('worker-test', 'device'), {
      token: 'test-token',
    });
  });

  test('probes once, even when several calls start before the probe settles', async () => {
    vi.stubGlobal('indexedDB', {});
    const store = createIndexedDbStore('unit-test');
    await Promise.all([store.get(), store.get('a'), store.isCompatible(), store.set('b', 1)]);
    expect(vi.mocked(set).mock.calls.filter(([key]) => key === STORAGE_TEST_DATA.key)).toHaveLength(
      1,
    );
  });

  test('runs parse on every stored value get reads, and lets its errors propagate', async () => {
    vi.stubGlobal('indexedDB', {});
    const parse = vi.fn((value: unknown) => {
      if (typeof value !== 'number') {
        throw new Error('not a number');
      }
      return value;
    });
    const store = createIndexedDbStore('unit-test', { parse });
    await expect(store.get()).resolves.toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
    vi.mocked(get).mockResolvedValue(7);
    await expect(store.get()).resolves.toBe(7);
    await expect(store.get()).resolves.toBe(7);
    expect(parse).toHaveBeenCalledTimes(2);
    vi.mocked(get).mockResolvedValue('seven');
    await expect(store.get()).rejects.toThrow('not a number');
  });

  test('without a fallback, get resolves undefined and set and del reject if IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createIndexedDbStore('unit-test');
    await expect(store.get()).resolves.toBeUndefined();
    await expectToRejectCode(store.set(undefined, { hello: 'World!' }), ERRORS.STORE_UNAVAILABLE);
    await expectToRejectCode(store.del(), ERRORS.STORE_UNAVAILABLE);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  test('with the memory fallback, it keeps records in memory if IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const storeId = 'unit-test';
    const recordId = undefined;
    const updateData = { hello: 'World!' };
    const store = createIndexedDbStore(storeId, { fallback: 'memory' });
    await expect(store.get(recordId)).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();

    await store.set(recordId, updateData);
    expect(set).not.toHaveBeenCalled();
    await expect(store.get(recordId)).resolves.toStrictEqual(updateData);

    await store.del();
    expect(del).not.toHaveBeenCalled();
    await expect(store.get(recordId)).resolves.toBeUndefined();
  });

  test('with the memory fallback, it falls back if the Storage object throws when invoking its methods', async () => {
    vi.stubGlobal('indexedDB', {});
    const storeId = 'unit-test';
    const recordId = undefined;
    const updateData = { hello: 'World!' };
    const store = createIndexedDbStore(storeId, { fallback: 'memory' });

    // makes set throw, so the compatibility probe fails
    mockSet();

    await expect(store.get(recordId)).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();

    // the compatibility probe called set
    expect(set).toHaveBeenNthCalledWith(1, STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value);

    // it isn't called again, because the store falls back to memory
    await store.set(recordId, updateData);
    expect(set).toHaveBeenCalledOnce();
    await expect(store.get(recordId)).resolves.toStrictEqual(updateData);

    await store.del();
    expect(del).not.toHaveBeenCalled();
  });

  test('can determine if the mechanism is compatible', async () => {
    vi.stubGlobal('indexedDB', undefined);
    const store = createIndexedDbStore('unit-test');
    await expect(store.isCompatible()).resolves.toBe(false);

    vi.stubGlobal('indexedDB', {});
    mockSet();
    const store2 = createIndexedDbStore('unit-test');
    await expect(store2.isCompatible()).resolves.toBe(false);
    vi.mocked(set).mockReset();

    vi.stubGlobal('indexedDB', {});
    const store3 = createIndexedDbStore('unit-test');
    await expect(store3.isCompatible()).resolves.toBe(true);
  });
});
