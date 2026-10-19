import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { z } from 'zod';

import { ERRORS } from '../shared/index.js';
import { useSearchParamState } from './search-param-state.hook.js';
import type { ISetSearchParamState, IUseSearchParamStateOptions } from './types.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

type IFilters = { query: string; page: number; tags: string[] };

const FiltersSchema = z.object({
  query: z.string(),
  page: z.coerce.number().int().min(1),
  tags: z.array(z.string()),
});

const OPTIONS: IUseSearchParamStateOptions<IFilters> = {
  params: { query: 'one', page: 'one', tags: 'many' },
  schema: FiltersSchema,
  defaultValue: { query: '', page: 1, tags: [] },
};

/**
 * Renders the hook in a memory router under StrictMode, recording every navigation.
 * @param entry The URL the router starts at.
 * @param options The hook's options, written inline as a component would.
 * @returns The hook's latest result, every result, the router, and its navigations.
 */
const renderInRouter = <T extends object>(
  entry: { search?: string; hash?: string; state?: unknown },
  options: () => IUseSearchParamStateOptions<T>,
) => {
  const results: [T, ISetSearchParamState<T>][] = [];
  const Probe = () => {
    results.push(useSearchParamState(options()));
    return null;
  };
  const router = createMemoryRouter([{ path: '/payments', element: <Probe /> }], {
    initialEntries: [{ pathname: '/payments', ...entry }],
  });
  const navigations: string[] = [];
  router.subscribe((state) => {
    navigations.push(`${state.historyAction} ${state.location.search}`);
  });
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
  const latest = (): [T, ISetSearchParamState<T>] => results.at(-1) as [T, ISetSearchParamState<T>];
  return { results, latest, router, navigations };
};

describe('useSearchParamState', () => {
  test('reads the owned keys through the schema, with the defaults filling missing ones', () => {
    const { latest } = renderInRouter({ search: '?page=3&tags=a&tags=b' }, () => OPTIONS);

    expect(latest()[0]).toStrictEqual({ query: '', page: 3, tags: ['a', 'b'] });
  });

  test('replaces a URL that is not canonical once, keeping the router state and the hash', async () => {
    const { latest, router, navigations } = renderInRouter(
      { search: '?page=1&tags=a&query=', hash: '#results', state: { from: '/dashboard' } },
      () => OPTIONS,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual(['REPLACE ?tags=a']);
    expect(router.state.location).toMatchObject({
      search: '?tags=a',
      hash: '#results',
      state: { from: '/dashboard' },
    });
    expect(latest()[0]).toStrictEqual({ query: '', page: 1, tags: ['a'] });
  });

  test('reads the defaults when the schema rejects the URL, and repairs it', async () => {
    const { latest, router } = renderInRouter({ search: '?page=0' }, () => OPTIONS);

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest()[0]).toStrictEqual(OPTIONS.defaultValue);
    expect(router.state.location.search).toBe('');
  });

  test('never loops on a schema that does not round-trip', async () => {
    const { navigations } = renderInRouter({ search: '?page=1' }, () => ({
      params: { page: 'one' },
      // each parse adds one, so no URL is ever canonical
      schema: {
        parse: (input: unknown) => ({ page: Number((input as { page: string }).page) + 1 }),
      },
      defaultValue: { page: 0 },
    }));

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });
    });

    expect(navigations).toStrictEqual(['REPLACE ?page=2']);
  });

  test('pushes a change, keeping the router state and the hash, which Back undoes', async () => {
    const { latest, router, navigations } = renderInRouter(
      { search: '?page=2', hash: '#results', state: { from: '/dashboard' } },
      () => OPTIONS,
    );

    await act(async () => {
      latest()[1]((current) => ({ ...current, page: 3 }));
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual(['PUSH ?page=3']);
    expect(router.state.location).toMatchObject({
      hash: '#results',
      state: { from: '/dashboard' },
    });
    await act(async () => {
      await router.navigate(-1);
    });
    expect(latest()[0].page).toBe(2);
  });

  test('replaces the entry instead with replace', async () => {
    const { latest, navigations } = renderInRouter({ search: '?page=2' }, () => OPTIONS);

    await act(async () => {
      latest()[1]({ ...latest()[0], query: 'card' }, { replace: true });
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual(['REPLACE ?query=card&page=2']);
  });

  test('applies two updaters made in one tick, each seeing the one before, in one navigation', async () => {
    const { latest, navigations } = renderInRouter({ search: '?page=2' }, () => OPTIONS);

    await act(async () => {
      const [, setFilters] = latest();
      setFilters((current) => ({ ...current, page: current.page + 1 }));
      setFilters((current) => ({
        ...current,
        tags: [...current.tags, `page-${String(current.page)}`],
      }));
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual(['PUSH ?page=3&tags=page-3']);
    expect(latest()[0]).toStrictEqual({ query: '', page: 3, tags: ['page-3'] });
  });

  test('pushes in one tick unless every change asked to replace', async () => {
    const { latest, navigations } = renderInRouter({ search: '?page=2' }, () => OPTIONS);

    await act(async () => {
      const [, setFilters] = latest();
      setFilters((current) => ({ ...current, page: 3 }), { replace: true });
      setFilters((current) => ({ ...current, page: 4 }));
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual(['PUSH ?page=4']);
  });

  test('navigates nowhere when the change leaves the search as it is', async () => {
    const { latest, navigations } = renderInRouter({ search: '?page=2' }, () => OPTIONS);

    await act(async () => {
      latest()[1]({ query: '', page: 2, tags: [] });
      await Promise.resolve();
    });

    expect(navigations).toStrictEqual([]);
  });

  test("keeps the setter's identity, and the value's while the owned keys don't change", async () => {
    const { results, router } = renderInRouter({ search: '?page=2' }, () => OPTIONS);
    const [firstValue, firstSetter] = results.at(-1) as [IFilters, ISetSearchParamState<IFilters>];

    await act(async () => {
      await router.navigate('/payments?page=2&utm=mail');
    });

    const [value, setter] = results.at(-1) as [IFilters, ISetSearchParamState<IFilters>];
    expect(setter).toBe(firstSetter);
    expect(value).toBe(firstValue);
  });

  test("keeps the keys it doesn't own, or removes them with unknownParams: 'remove'", async () => {
    const kept = renderInRouter({ search: '?utm=mail&page=2' }, () => OPTIONS);
    await act(async () => {
      kept.latest()[1]((current) => ({ ...current, page: 3 }));
      await Promise.resolve();
    });
    expect(kept.router.state.location.search).toBe('?utm=mail&page=3');
    cleanup();

    const removed = renderInRouter({ search: '?utm=mail&page=2' }, () => ({
      ...OPTIONS,
      unknownParams: 'remove' as const,
    }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(removed.router.state.location.search).toBe('?page=2');
  });

  test('throws INVALID_SEARCH_PARAM_VALUE where a value the URL cannot hold is set', () => {
    const { latest } = renderInRouter({ search: '' }, () => OPTIONS);

    expect(() => {
      latest()[1]({ query: { text: 'card' } as unknown as string, page: 1, tags: [] });
    }).toThrow(expect.objectContaining({ code: ERRORS.INVALID_SEARCH_PARAM_VALUE }) as Error);
  });
});
