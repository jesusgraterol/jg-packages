import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { SEARCH_DEBOUNCE_MS } from './constants.js';
import { useDebouncedSearch } from './debounced-search.hook.js';
import type { IUseDebouncedSearchOptions } from './types.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  vi.useRealTimers();
});

// a search the test settles, with the signal it was given
type IPendingSearch = {
  query: string;
  signal: AbortSignal;
  resolve: (results: string[]) => void;
  reject: (error: unknown) => void;
};

/**
 * Creates a search function whose calls wait for the test to settle them.
 * @returns The function and its calls.
 */
const createSearch = () => {
  const calls: IPendingSearch[] = [];
  const search = vi.fn(
    (query: string, signal: AbortSignal) =>
      new Promise<string[]>((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      }),
  );
  return { search, calls };
};

/**
 * Renders the hook with its options as props, so a test can change them.
 * @param options The hook's options.
 * @returns The rendered hook.
 */
const renderSearch = (options: IUseDebouncedSearchOptions<string[]>) =>
  renderHook((props: IUseDebouncedSearchOptions<string[]>) => useDebouncedSearch(props), {
    initialProps: options,
  });

/**
 * Lets the debounce run out, and the search start.
 */
const passDebounce = (): void => {
  act(() => {
    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
  });
};

/**
 * Settles a search and lets React apply its result.
 * @param settle Resolves or rejects the search.
 */
const settleSearch = async (settle: () => void): Promise<void> => {
  await act(async () => {
    settle();
    await Promise.resolve();
  });
};

describe('useDebouncedSearch', () => {
  test('searches the trimmed query once it stays unchanged for 0.3 seconds', async () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { result, rerender } = renderSearch({ query: 'a', search });
    expect(result.current).toMatchObject({ results: undefined, isSearching: true, error: null });

    rerender({ query: 'ab', search });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    rerender({ query: '  abc  ', search });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });
    expect(search).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(search).toHaveBeenCalledTimes(1);
    expect(calls[0]?.query).toBe('abc');
    await settleSearch(() => calls[0]?.resolve(['abc result']));
    expect(result.current).toMatchObject({
      results: ['abc result'],
      isSearching: false,
      error: null,
    });
  });

  test('aborts the search in flight when the query changes, and ignores its late result', async () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { result, rerender } = renderSearch({ query: 'first', search });
    passDebounce();

    rerender({ query: 'second', search });
    expect(calls[0]?.signal.aborted).toBe(true);
    await settleSearch(() => calls[0]?.resolve(['first result']));
    expect(result.current).toMatchObject({ results: undefined, isSearching: true });

    passDebounce();
    await settleSearch(() => calls[1]?.resolve(['second result']));
    expect(result.current).toMatchObject({ results: ['second result'], isSearching: false });
  });

  test("ignores the rejection of a search it aborted, such as fetch's AbortError", async () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { result, rerender } = renderSearch({ query: 'first', search });
    passDebounce();

    rerender({ query: 'second', search });
    await settleSearch(() => calls[0]?.reject(new DOMException('Aborted.', 'AbortError')));

    expect(result.current).toMatchObject({ isSearching: true, error: null });
  });

  test('keeps the previous results while the next search runs', async () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { result, rerender } = renderSearch({ query: 'first', search });
    passDebounce();
    await settleSearch(() => calls[0]?.resolve(['first result']));

    rerender({ query: 'second', search });

    expect(result.current).toMatchObject({ results: ['first result'], isSearching: true });
  });

  test('aborts the search in flight on unmount', () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { unmount } = renderSearch({ query: 'query', search });
    passDebounce();

    unmount();

    expect(calls[0]?.signal.aborted).toBe(true);
  });

  test.each([
    ['the query is emptied', { query: '   ' }],
    ['the search is disabled', { enabled: false }],
  ])('clears everything and aborts the search when %s', async (_, change) => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const { result, rerender } = renderSearch({ query: 'first', search });
    passDebounce();
    await settleSearch(() => calls[0]?.resolve(['first result']));
    rerender({ query: 'second', search });
    passDebounce();

    rerender({ query: 'second', search, ...change });

    expect(calls[1]?.signal.aborted).toBe(true);
    expect(result.current).toMatchObject({ results: undefined, isSearching: false, error: null });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
    });
    expect(search).toHaveBeenCalledTimes(2);
  });

  test('gives the error of a failed search, and searches again on retry', async () => {
    vi.useFakeTimers();
    const { search, calls } = createSearch();
    const failure = new Error('The search service is down.');
    const { result } = renderSearch({ query: 'query', search });
    passDebounce();
    await settleSearch(() => calls[0]?.reject(failure));
    expect(result.current).toMatchObject({
      results: undefined,
      isSearching: false,
      error: failure,
    });
    const { retry } = result.current;

    act(() => {
      result.current.retry();
    });
    expect(result.current).toMatchObject({ isSearching: true, error: null });
    passDebounce();
    await settleSearch(() => calls[1]?.resolve(['result']));

    expect(calls[1]?.query).toBe('query');
    expect(result.current).toMatchObject({ results: ['result'], isSearching: false, error: null });
    expect(result.current.retry).toBe(retry);
  });

  test('gives the error of a search that throws instead of returning a promise', async () => {
    vi.useFakeTimers();
    const failure = new Error('Not configured.');
    const { result } = renderSearch({
      query: 'query',
      search: () => {
        throw failure;
      },
    });

    passDebounce();
    await settleSearch(() => undefined);

    expect(result.current).toMatchObject({ isSearching: false, error: failure });
  });

  test('calls the latest search function without restarting the debounce', () => {
    vi.useFakeTimers();
    const first = createSearch();
    const second = createSearch();
    const { rerender } = renderSearch({ query: 'query', search: first.search });
    act(() => {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
    });

    rerender({ query: 'query', search: second.search });
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(first.search).not.toHaveBeenCalled();
    expect(second.search).toHaveBeenCalledTimes(1);
  });
});
