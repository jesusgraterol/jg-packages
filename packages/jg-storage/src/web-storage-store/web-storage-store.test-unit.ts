import { expectToThrowCode } from 'jg-exception/testing';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS, STORAGE_TEST_DATA, buildDataKey, stringifyJSON } from '../shared/index.js';
import { createFakeStorage } from '../shared/storage.test-utils.js';
import { createLocalStore, createSessionStore } from './web-storage-store.js';

// a Storage whose methods only record their calls, returned with its mocked methods
const createSpyStorage = () => {
  const getItem = vi.fn((): string | null => null);
  const setItem = vi.fn();
  const removeItem = vi.fn();
  const storage = { getItem, setItem, removeItem } as unknown as Storage;
  return { storage, getItem, setItem, removeItem };
};

// a Storage that throws on every write, as a browser does when storage is blocked or full
const createFailingStorage = () => {
  const spy = createSpyStorage();
  const fail = (): never => {
    throw new Error('The storage is not supported!');
  };
  spy.setItem.mockImplementation(fail);
  spy.removeItem.mockImplementation(fail);
  return spy;
};

describe('createLocalStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test('it can interact with the Browser Storage API when compatible', () => {
    const { storage, getItem, setItem, removeItem } = createSpyStorage();
    vi.stubGlobal('localStorage', storage);
    const storeId = 'unit-test';
    const recordId = undefined;
    const updateData = { hello: 'World!' };
    const store = createLocalStore(storeId);
    expect(setItem).not.toHaveBeenCalled();
    expect(store.id).toBe(storeId);
    expect(store.mechanism).toBe('localStorage');
    expect(store.get(recordId)).toBeUndefined();
    expect(getItem).toHaveBeenNthCalledWith(1, buildDataKey(storeId, recordId));

    // the first setItem and removeItem calls probe the compatibility
    expect(setItem).toHaveBeenNthCalledWith(1, STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value);
    store.set(recordId, updateData);
    expect(setItem).toHaveBeenNthCalledWith(
      2,
      buildDataKey(storeId, recordId),
      stringifyJSON(updateData),
    );
    store.del();
    expect(removeItem).toHaveBeenNthCalledWith(2, buildDataKey(storeId, recordId));
  });

  test('reads localStorage on the first call, never when the store is created', () => {
    vi.stubGlobal('localStorage', undefined);
    const store = createLocalStore('lazy');
    const { storage, setItem } = createSpyStorage();
    vi.stubGlobal('localStorage', storage);
    expect(store.isCompatible()).toBe(true);
    expect(setItem).toHaveBeenCalledOnce();

    // the probe's result is remembered
    expect(store.isCompatible()).toBe(true);
    expect(setItem).toHaveBeenCalledOnce();
  });

  test('round-trips JSON values, primitives included, under the old keys', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore<unknown>('settings');
    const values = [{ theme: 'dark' }, [1, 2], 'text', 0, 12.5, true, false, null];
    for (const value of values) {
      store.set(undefined, value);
      expect(storage.getItem('settings')).toBe(JSON.stringify(value));
      expect(store.get()).toStrictEqual(value);
    }
    store.set('draft', 'record');
    expect(storage.getItem('settings_draft')).toBe('"record"');
    expect(store.get('draft')).toBe('record');
  });

  test('rejects values JSON can not represent and leaves the stored value as it was', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore<unknown>('settings');
    store.set(undefined, { theme: 'dark' });
    expectToThrowCode(() => store.set(undefined, undefined), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expectToThrowCode(() => store.set(undefined, 10n), ERRORS.FAILED_TO_STRINGIFY_JSON);
    expect(store.get()).toStrictEqual({ theme: 'dark' });
  });

  test('throws FAILED_TO_PARSE_JSON when a stored value is not JSON, and reads empty strings as missing', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore('settings');
    storage.setItem('settings', '{not json');
    expectToThrowCode(() => store.get(), ERRORS.FAILED_TO_PARSE_JSON);
    storage.setItem('settings', '');
    expect(store.get()).toBeUndefined();
  });

  test('runs parse on every stored value get reads, and lets its errors propagate', () => {
    const storage = createFakeStorage();
    vi.stubGlobal('localStorage', storage);
    const parse = vi.fn((value: unknown) => {
      if (typeof value !== 'object' || value === null || !('theme' in value)) {
        throw new Error('invalid settings');
      }
      return { theme: String(value.theme) };
    });
    const store = createLocalStore('settings', { parse });
    expect(store.get()).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
    store.set(undefined, { theme: 'dark' });
    expect(store.get()).toStrictEqual({ theme: 'dark' });
    expect(store.get()).toStrictEqual({ theme: 'dark' });
    expect(parse).toHaveBeenCalledTimes(2);
    storage.setItem('settings', '{"color":"red"}');
    expect(() => store.get()).toThrow('invalid settings');
  });

  test('without a fallback, get returns undefined and set and del throw when localStorage is missing', () => {
    vi.stubGlobal('localStorage', undefined);
    const store = createLocalStore('unit-test');
    expect(store.isCompatible()).toBe(false);
    expect(store.get()).toBeUndefined();
    expectToThrowCode(() => store.set(undefined, { hello: 'World!' }), ERRORS.STORE_UNAVAILABLE);
    expectToThrowCode(() => store.del(), ERRORS.STORE_UNAVAILABLE);
  });

  test('without a fallback, set and del throw when the Storage object throws when invoking its methods', () => {
    const { storage, getItem, setItem, removeItem } = createFailingStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore('unit-test');
    expect(store.get()).toBeUndefined();
    expect(getItem).not.toHaveBeenCalled();

    // the compatibility probe called setItem
    expect(setItem).toHaveBeenNthCalledWith(1, STORAGE_TEST_DATA.key, STORAGE_TEST_DATA.value);
    expectToThrowCode(() => store.set(undefined, { hello: 'World!' }), ERRORS.STORE_UNAVAILABLE);
    expectToThrowCode(() => store.del(), ERRORS.STORE_UNAVAILABLE);
    expect(setItem).toHaveBeenCalledOnce();
    expect(removeItem).not.toHaveBeenCalled();
  });

  test('without a fallback, set and del throw when reading localStorage throws', () => {
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('The operation is insecure.');
      },
    });
    const store = createLocalStore('unit-test');
    expect(store.isCompatible()).toBe(false);
    expectToThrowCode(() => store.set(undefined, 1), ERRORS.STORE_UNAVAILABLE);
  });

  test('with the memory fallback, it keeps records in memory when localStorage is missing', () => {
    vi.stubGlobal('localStorage', undefined);
    const parse = vi.fn((value: unknown) => value as { hello: string });
    const store = createLocalStore('unit-test', { fallback: 'memory', parse });
    const other = createLocalStore('unit-test', { fallback: 'memory' });
    expect(store.isCompatible()).toBe(false);
    expect(store.get()).toBeUndefined();
    store.set(undefined, { hello: 'World!' });
    store.set('record', { hello: 'Record!' });
    expect(store.get()).toStrictEqual({ hello: 'World!' });
    expect(store.get('record')).toStrictEqual({ hello: 'Record!' });
    expect(parse).toHaveBeenCalledTimes(2);
    expect(other.get()).toBeUndefined();
    store.del();
    expect(store.get()).toBeUndefined();
    expect(store.get('record')).toStrictEqual({ hello: 'Record!' });
  });

  test('with the memory fallback, it falls back when the Storage object throws when invoking its methods', () => {
    const { storage, getItem, setItem, removeItem } = createFailingStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createLocalStore('unit-test', { fallback: 'memory' });
    store.set(undefined, { hello: 'World!' });
    expect(store.get()).toStrictEqual({ hello: 'World!' });
    store.del();
    expect(store.get()).toBeUndefined();

    // only the compatibility probe reached the storage
    expect(setItem).toHaveBeenCalledOnce();
    expect(getItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  test('can determine if the mechanism is compatible', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(createLocalStore('unit-test').isCompatible()).toBe(false);

    vi.stubGlobal('localStorage', createFailingStorage().storage);
    expect(createLocalStore('unit-test').isCompatible()).toBe(false);

    vi.stubGlobal('localStorage', createSpyStorage().storage);
    expect(createLocalStore('unit-test').isCompatible()).toBe(true);
  });
});

describe('createSessionStore', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  test('uses sessionStorage and leaves localStorage alone', () => {
    const local = createFakeStorage();
    const session = createFakeStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    const store = createSessionStore<number>('wizard-step');
    expect(store.mechanism).toBe('sessionStorage');
    store.set(undefined, 2);
    expect(session.getItem('wizard-step')).toBe('2');
    expect(local.length).toBe(0);
    expect(store.get()).toBe(2);
    store.del();
    expect(session.length).toBe(0);
  });

  test('without a fallback, set throws when sessionStorage is missing', () => {
    vi.stubGlobal('sessionStorage', undefined);
    const store = createSessionStore('wizard-step');
    expect(store.get()).toBeUndefined();
    expectToThrowCode(() => store.set(undefined, 2), ERRORS.STORE_UNAVAILABLE);
  });
});
