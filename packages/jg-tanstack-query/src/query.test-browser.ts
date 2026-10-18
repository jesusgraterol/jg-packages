import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { cleanup, configure, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { clearQueryCache, createQueryClient } from './client/index.js';
import { createIndexedDbPersister } from './persister/index.js';
import { PersistedQueryProvider } from './provider/index.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

// queries wait for the restore, which opens a new IndexedDB database first: a cold Firefox in CI
// can take more than Testing Library's default second to do that
configure({ asyncUtilTimeout: 5_000 });

/**
 * Creates a persister on a database no other test uses.
 * @returns The persister.
 */
const createTestPersister = (): Persister =>
  createIndexedDbPersister({
    databaseName: `jg-tanstack-query-test-${crypto.randomUUID()}`,
    storeName: 'queries',
    key: 'query-client',
  });

/**
 * Renders a component inside a PersistedQueryProvider.
 * @param client The client.
 * @param persister Its persister.
 * @param Component The component.
 * @returns What render returns.
 */
const renderWithProvider = (client: QueryClient, persister: Persister, Component: () => unknown) =>
  render(
    createElement(
      PersistedQueryProvider,
      { client, persister, buster: 'v1' },
      createElement(Component as () => null),
    ),
  );

/**
 * Waits until the persisted copy holds a query, which happens after the cache changes.
 * @param persister The persister.
 * @param check Whether the copy is the one expected.
 * @returns A promise that resolves to the copy.
 */
const waitForPersisted = async (
  persister: Persister,
  check: (copy: PersistedClient) => boolean,
): Promise<PersistedClient> => {
  let copy: PersistedClient | undefined;
  await vi.waitFor(async () => {
    copy = await persister.restoreClient();
    expect(copy !== undefined && check(copy)).toBe(true);
  });
  return copy as PersistedClient;
};

describe('PersistedQueryProvider', () => {
  test('restores an opted-in query after a reload, without fetching it again', async () => {
    const persister = createTestPersister();
    const Profile = () => {
      const { data } = useQuery({
        queryKey: ['profile'],
        queryFn: () => Promise.resolve({ name: 'Ada' }),
        meta: { persist: true },
        staleTime: Number.POSITIVE_INFINITY,
      });
      return createElement('p', null, data?.name ?? 'loading');
    };
    const firstSession = renderWithProvider(createQueryClient(), persister, Profile);
    await screen.findByText('Ada');
    await waitForPersisted(persister, (copy) => copy.clientState.queries.length === 1);
    firstSession.unmount();

    const queryFn = vi.fn(() => Promise.resolve({ name: 'fetched again' }));
    const Reloaded = () => {
      const { data } = useQuery({
        queryKey: ['profile'],
        queryFn,
        meta: { persist: true },
        staleTime: Number.POSITIVE_INFINITY,
      });
      return createElement('p', null, data?.name ?? 'loading');
    };
    renderWithProvider(createQueryClient(), persister, Reloaded);

    await screen.findByText('Ada');
    expect(queryFn).not.toHaveBeenCalled();
  });

  test('never persists a mutation, or a query that did not opt in', async () => {
    const persister = createTestPersister();
    const Form = () => {
      const opted = useQuery({
        queryKey: ['opted'],
        queryFn: () => Promise.resolve(1),
        meta: { persist: true },
      });
      useQuery({ queryKey: ['private'], queryFn: () => Promise.resolve(2) });
      const { mutate, isSuccess } = useMutation({ mutationFn: () => Promise.resolve('saved') });
      return createElement(
        'button',
        { type: 'button', onClick: () => mutate() },
        isSuccess ? 'saved' : `save ${String(opted.data)}`,
      );
    };
    renderWithProvider(createQueryClient(), persister, Form);
    (await screen.findByText('save 1')).click();
    await screen.findByText('saved');

    const copy = await waitForPersisted(
      persister,
      ({ clientState }) => clientState.queries.length > 0,
    );

    expect(copy.clientState.queries.map(({ queryKey }) => queryKey)).toStrictEqual([['opted']]);
    expect(copy.clientState.mutations).toStrictEqual([]);
  });
});

describe('clearQueryCache', () => {
  test('waits for a pending restoration, then clears the memory and the persisted copy', async () => {
    const persister = createTestPersister();
    await persister.persistClient({
      timestamp: Date.now(),
      buster: 'v1',
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ['private-record'],
            queryHash: '["private-record"]',
            state: {
              data: { id: 'private-record' },
              dataUpdateCount: 1,
              dataUpdatedAt: Date.now(),
              error: null,
              errorUpdateCount: 0,
              errorUpdatedAt: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
              fetchMeta: null,
              isInvalidated: false,
              status: 'success',
              fetchStatus: 'idle',
            },
          },
        ],
      },
    });
    let releaseRestore: () => void = () => undefined;
    const slowPersister: Persister = {
      ...persister,
      restoreClient: async () => {
        await new Promise<void>((resolve) => {
          releaseRestore = resolve;
        });
        return persister.restoreClient();
      },
    };
    const client = createQueryClient();
    renderWithProvider(client, slowPersister, () => null);

    const clearing = clearQueryCache(client, persister);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(await persister.restoreClient()).toBeDefined();

    releaseRestore();
    await clearing;

    expect(client.getQueryData(['private-record'])).toBeUndefined();
    await waitFor(async () => {
      expect(await persister.restoreClient()).toBeUndefined();
    });
  });
});
