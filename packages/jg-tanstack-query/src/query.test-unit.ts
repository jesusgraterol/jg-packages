import type { Persister } from '@tanstack/react-query-persist-client';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  DEFAULT_QUERY_MAX_AGE_SECONDS,
  clearQueryCache,
  createQueryClient,
} from './client/index.js';
import { trackRestoration } from './client/restoration.js';
import { createIndexedDbPersister } from './persister/index.js';
import { PersistedQueryProvider } from './provider/index.js';
import { shouldPersistMutation, shouldPersistQuery } from './provider/utilities.js';

/**
 * Builds a persister whose removal the test controls.
 * @returns The persister.
 */
const createFakePersister = () => ({
  persistClient: vi.fn(() => Promise.resolve()),
  restoreClient: vi.fn(() => Promise.resolve(undefined)),
  removeClient: vi.fn(() => Promise.resolve()),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createQueryClient', () => {
  test('keeps safe defaults: no retries, no refetch on focus, and data kept 10 days', () => {
    expect(DEFAULT_QUERY_MAX_AGE_SECONDS).toBe(864_000);
    expect(createQueryClient().getDefaultOptions()).toStrictEqual({
      queries: { gcTime: 864_000_000, retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    });
  });

  test('keeps unused data as long as its maximum age', () => {
    expect(createQueryClient({ maxAgeSeconds: 60 }).getDefaultOptions().queries?.gcTime).toBe(
      60_000,
    );
  });
});

describe('clearQueryCache', () => {
  test('waits for the restoration before clearing, and shares one clear among concurrent calls', async () => {
    const client = createQueryClient();
    const persister = createFakePersister();
    const restoration = trackRestoration(client);
    client.setQueryData(['private-record'], { id: 'private-record' });

    const first = clearQueryCache(client, persister);
    const second = clearQueryCache(client, persister);
    await Promise.resolve();

    expect(first).toBe(second);
    expect(client.getQueryData(['private-record'])).toStrictEqual({ id: 'private-record' });
    expect(persister.removeClient).not.toHaveBeenCalled();

    restoration.finish();
    await first;

    expect(client.getQueryData(['private-record'])).toBeUndefined();
    expect(persister.removeClient).toHaveBeenCalledOnce();
  });

  test("rejects with the persister's removal error, after clearing the memory", async () => {
    const client = createQueryClient();
    const removalError = new Error('IndexedDB removal failed.');
    const persister: Persister = {
      ...createFakePersister(),
      removeClient: () => Promise.reject(removalError),
    };
    client.setQueryData(['private-record'], { id: 'private-record' });

    await expect(clearQueryCache(client, persister)).rejects.toBe(removalError);
    expect(client.getQueryData(['private-record'])).toBeUndefined();
  });

  test("tracks each client's restoration on its own, so one client's restore never holds another's clear", async () => {
    const restoring = createQueryClient();
    const restored = createQueryClient();
    trackRestoration(restoring);
    restored.setQueryData(['record'], 1);

    await clearQueryCache(restored, createFakePersister());

    expect(restored.getQueryData(['record'])).toBeUndefined();
  });

  test("tracks a client's restoration once, however often its provider renders", () => {
    const client = createQueryClient();

    expect(trackRestoration(client)).toBe(trackRestoration(client));
  });

  test('clears again after a clear finished', async () => {
    const client = createQueryClient();
    const persister = createFakePersister();

    await clearQueryCache(client, persister);
    client.setQueryData(['record'], 2);
    await clearQueryCache(client, persister);

    expect(client.getQueryData(['record'])).toBeUndefined();
    expect(persister.removeClient).toHaveBeenCalledTimes(2);
  });
});

describe('persistence choices', () => {
  test('persists only successful queries that opt in, and never a mutation', async () => {
    const client = createQueryClient();
    await client.fetchQuery({ queryKey: ['opted-in'], queryFn: () => 1, meta: { persist: true } });
    await client.fetchQuery({ queryKey: ['private'], queryFn: () => 2 });
    await client
      .fetchQuery({
        queryKey: ['failed'],
        queryFn: () => Promise.reject(new Error('down')),
        meta: { persist: true },
      })
      .catch(() => undefined);
    const find = (key: string) => client.getQueryCache().find({ queryKey: [key] });

    expect(
      [find('opted-in'), find('private'), find('failed')].map(
        (query) => query && shouldPersistQuery(query),
      ),
    ).toStrictEqual([true, false, false]);
    expect(shouldPersistMutation()).toBe(false);
  });
});

describe('without IndexedDB', () => {
  test('the persister restores nothing, and stores and removes without failing', async () => {
    const persister = createIndexedDbPersister({
      databaseName: 'test-query-cache',
      storeName: 'queries',
      key: 'query-client',
    });

    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(
      persister.persistClient({
        timestamp: 0,
        buster: 'v1',
        clientState: { queries: [], mutations: [] },
      }),
    ).resolves.toBeUndefined();
    await expect(persister.removeClient()).resolves.toBeUndefined();
  });

  test('the provider still provides the client, without persistence', () => {
    const client = createQueryClient();

    expect(
      renderToString(
        createElement(
          PersistedQueryProvider,
          { client, persister: createFakePersister(), buster: 'v1' },
          createElement('p', null, 'app'),
        ),
      ),
    ).toBe('<p>app</p>');
  });
});

describe('with IndexedDB', () => {
  test('the provider restores and persists through the persister, and tracks the restoration', () => {
    vi.stubGlobal('indexedDB', {});
    const client = createQueryClient();

    expect(
      renderToString(
        createElement(
          PersistedQueryProvider,
          { client, persister: createFakePersister(), buster: 'v1' },
          createElement('p', null, 'app'),
        ),
      ),
    ).toBe('<p>app</p>');
    // the clear waits for a restoration that a server render never finishes
    let isCleared = false;
    void clearQueryCache(client, createFakePersister()).then(() => {
      isCleared = true;
    });
    return Promise.resolve().then(() => {
      expect(isCleared).toBe(false);
    });
  });
});
