import { indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, expectTypeOf, test, vi } from 'vitest';
import { z } from 'zod';

import { createIndexedDbStore } from './indexed-db-store/index.js';
import { createMemoryStore } from './memory-store/index.js';
import type { IAsyncStore, ISyncStore } from './shared/index.js';
import { createFakeStorage } from './shared/storage.test-utils.js';
import { createLocalStore, createSessionStore } from './web-storage-store/index.js';

/*
 * Contract tests: every store validates what get reads with a real Zod schema, and lets the
 * schema's error through unchanged.
 */

// a schema that also transforms, so a test can tell its output from the stored value
const Settings = z.object({
  theme: z.enum(['light', 'dark']),
  fontSize: z.number().int().default(16),
});
type ISettings = z.infer<typeof Settings>;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('synchronous stores', () => {
  const factories = [
    ['memory', () => createMemoryStore('settings', { schema: Settings })],
    [
      'localStorage',
      () => {
        vi.stubGlobal('localStorage', createFakeStorage());
        return createLocalStore('settings', { schema: Settings });
      },
    ],
    [
      'sessionStorage',
      () => {
        vi.stubGlobal('sessionStorage', createFakeStorage());
        return createSessionStore('settings', { schema: Settings });
      },
    ],
  ] as const;

  test.each(factories)('%s returns what the schema returns', (_, create) => {
    const store = create();
    store.set('user-1', { theme: 'dark' } as ISettings);

    expect(store.get('user-1')).toStrictEqual({ theme: 'dark', fontSize: 16 });
    expect(store.get('missing')).toBeUndefined();
  });

  test.each(factories)("%s lets the schema's error through unchanged", (_, create) => {
    const store = create();
    store.set('user-1', { theme: 'blue' } as unknown as ISettings);

    expect(() => store.get('user-1')).toThrow(z.ZodError);
  });
});

describe('IndexedDB stores', () => {
  test('return what the schema returns, and let its error through unchanged', async () => {
    vi.stubGlobal('indexedDB', indexedDB);
    const store = createIndexedDbStore('settings-contract', { schema: Settings });

    await store.set('user-1', { theme: 'light' } as ISettings);
    await store.set('user-2', { theme: 'blue' } as unknown as ISettings);

    await expect(store.get('user-1')).resolves.toStrictEqual({ theme: 'light', fontSize: 16 });
    await expect(store.get('user-2')).rejects.toBeInstanceOf(z.ZodError);
  });
});

describe('types', () => {
  test("a store's record type comes from its schema", () => {
    expectTypeOf(createMemoryStore('settings', { schema: Settings })).toEqualTypeOf<
      ISyncStore<ISettings>
    >();
    expectTypeOf(createLocalStore('settings', { schema: Settings })).toEqualTypeOf<
      ISyncStore<ISettings>
    >();
    expectTypeOf(createIndexedDbStore('settings', { schema: Settings })).toEqualTypeOf<
      IAsyncStore<ISettings>
    >();
    expectTypeOf(createMemoryStore<number>('count')).toEqualTypeOf<ISyncStore<number>>();
  });
});
