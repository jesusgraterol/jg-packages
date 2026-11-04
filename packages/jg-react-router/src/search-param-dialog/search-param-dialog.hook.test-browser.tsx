import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';

import { useSearchParamDialog } from './search-param-dialog.hook.js';
import type { ISearchParamDialog } from './types.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

/**
 * Renders two components that share the `event` dialog in a memory router under StrictMode,
 * recording every navigation.
 * @param entry The URL the router starts at.
 * @returns Each component's latest result, the router, and its navigations.
 */
const renderInRouter = (entry: { search?: string; hash?: string; state?: unknown }) => {
  const results: Record<'list' | 'dialog', ISearchParamDialog[]> = { list: [], dialog: [] };
  const List = () => {
    results.list.push(useSearchParamDialog('event'));
    return null;
  };
  const Dialog = () => {
    results.dialog.push(useSearchParamDialog('event'));
    return null;
  };
  const router = createMemoryRouter(
    [
      {
        path: '/sessions/1',
        element: (
          <>
            <List />
            <Dialog />
          </>
        ),
      },
    ],
    { initialEntries: ['/start', { pathname: '/sessions/1', ...entry }], initialIndex: 1 },
  );
  const navigations: string[] = [];
  router.subscribe((state) => {
    navigations.push(`${state.historyAction} ${state.location.search}`);
  });
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  const latest = (owner: 'list' | 'dialog'): ISearchParamDialog =>
    results[owner].at(-1) as ISearchParamDialog;
  return { latest, router, navigations };
};

/**
 * Lets the router's navigation and the hook's repairs settle.
 * @returns A promise that resolves once they have.
 */
const settle = () =>
  act(async () => {
    await Promise.resolve();
  });

describe('useSearchParamDialog', () => {
  test('opens on an ID with a new history entry, keeping the other parameters, the hash and the router state', async () => {
    const { latest, router, navigations } = renderInRouter({
      search: '?tab=events',
      hash: '#latest',
      state: { from: '/sessions' },
    });
    expect(latest('dialog').openId).toBe('');

    act(() => {
      latest('list').open('event-7');
    });
    await settle();

    expect(navigations).toStrictEqual(['PUSH ?tab=events&event=event-7']);
    expect(router.state.location).toMatchObject({
      hash: '#latest',
      state: { from: '/sessions', searchParamDialog: 'event' },
    });
    expect(latest('dialog').openId).toBe('event-7');
  });

  test('closes by going back past the entry its opening added, whichever component closes it', async () => {
    const { latest, router, navigations } = renderInRouter({ search: '?tab=events' });
    act(() => {
      latest('list').open('event-7');
    });
    await settle();

    act(() => {
      latest('dialog').close();
    });
    await settle();

    expect(navigations).toStrictEqual(['PUSH ?tab=events&event=event-7', 'POP ?tab=events']);
    expect(router.state.location.pathname).toBe('/sessions/1');
    expect(latest('list').openId).toBe('');
  });

  test('closes on Back, as the system back gesture does', async () => {
    const { latest, router } = renderInRouter({});
    act(() => {
      latest('list').open('event-7');
    });
    await settle();

    await act(async () => {
      await router.navigate(-1);
    });

    expect(latest('dialog').openId).toBe('');
  });

  test('closes a dialog the URL opened in place, replacing the entry and keeping the rest', async () => {
    const { latest, router, navigations } = renderInRouter({
      search: '?tab=events&event=event-3',
      state: { from: '/sessions' },
    });
    expect(latest('dialog').openId).toBe('event-3');

    act(() => {
      latest('dialog').close();
    });
    await settle();

    expect(navigations).toStrictEqual(['REPLACE ?tab=events']);
    expect(router.state.location).toMatchObject({
      pathname: '/sessions/1',
      state: { from: '/sessions' },
    });
    expect(latest('list').openId).toBe('');
  });

  test('reads an empty ID and one longer than 4,096 characters as closed, and repairs the URL', async () => {
    const longest = 'e'.repeat(4096);
    const opened = renderInRouter({ search: `?event=${longest}` });
    expect(opened.latest('dialog').openId).toBe(longest);
    cleanup();

    const { latest, router, navigations } = renderInRouter({
      search: `?tab=events&event=${longest}e`,
    });
    expect(latest('dialog').openId).toBe('');
    await settle();
    // both components read the dialog, and the URL is replaced once
    expect(navigations).toStrictEqual(['REPLACE ?tab=events']);
    expect(router.state.location.search).toBe('?tab=events');
    cleanup();

    const empty = renderInRouter({ search: '?event=' });
    expect(empty.latest('dialog').openId).toBe('');
  });

  test('keeps open and close the same across renders', async () => {
    const { latest } = renderInRouter({});
    const { open, close } = latest('list');

    act(() => {
      open('event-7');
    });
    await settle();

    expect(latest('list').open).toBe(open);
    expect(latest('list').close).toBe(close);
  });
});
