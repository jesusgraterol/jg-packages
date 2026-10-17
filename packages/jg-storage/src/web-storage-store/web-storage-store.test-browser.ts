import { afterEach, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { createLocalStore, createSessionStore } from './web-storage-store.js';

/*
 * The web storage stores against the browser's own localStorage and sessionStorage, in Chromium,
 * Firefox, and WebKit.
 */

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe.each([
  ['localStorage', createLocalStore, () => localStorage],
  ['sessionStorage', createSessionStore, () => sessionStorage],
] as const)('a store over %s', (_, createStore, getStorage) => {
  test('round-trips JSON values, primitives included, under jg-storage keys', () => {
    const store = createStore<unknown>('settings');
    const values = [{ theme: 'dark' }, [1, 2], 'text', 0, 12.5, true, false, null];

    expect(store.isCompatible()).toBe(true);
    for (const value of values) {
      store.set(undefined, value);
      expect(getStorage().getItem('jg-storage:settings')).toBe(JSON.stringify(value));
      expect(store.get()).toStrictEqual(value);
    }
    store.set('draft', { theme: 'light' });
    expect(getStorage().getItem('jg-storage:settings:draft')).toBe('{"theme":"light"}');
    store.del('draft');
    expect(getStorage().getItem('jg-storage:settings:draft')).toBeNull();
    expect(store.get('draft')).toBeUndefined();
  });

  test('reaches the same record with 1 and "1", and never leaves the probe behind', () => {
    const store = createStore<string>('ids');
    store.set(1, 'one');

    expect(store.get('1')).toBe('one');
    expect(getStorage().getItem('jg-storage-probe')).toBeNull();
  });

  test('keeps the records of a store named probe through probes', () => {
    const probe = createStore<string>('probe');
    probe.set(undefined, 'root');

    expect(createStore('other').isCompatible()).toBe(true);
    expect(probe.get()).toBe('root');
  });

  test('shares records between stores with the same id, and validates them with a schema', () => {
    createStore<{ theme: string }>('shared').set(undefined, { theme: 'dark' });
    const validated = createStore('shared', {
      schema: z.object({ theme: z.enum(['light', 'dark']), size: z.number().default(16) }),
    });

    expect(validated.get()).toStrictEqual({ theme: 'dark', size: 16 });
    getStorage().setItem('jg-storage:shared', '{"theme":"blue"}');
    expect(() => validated.get()).toThrow(z.ZodError);
  });
});
