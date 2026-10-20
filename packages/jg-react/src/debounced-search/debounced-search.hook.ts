import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from './constants.js';
import type { IUseDebouncedSearchOptions, IUseDebouncedSearchResult } from './types.js';

// what the last search to settle gave, and the query and attempt it ran for
type ISettledSearch = {
  key: string | null;
  results: unknown;
  error: unknown;
};

// the state before any search, and after the query is emptied or the search disabled
const NO_SEARCH: ISettledSearch = { key: null, results: undefined, error: null };

/**
 * Searches as the user types: once the trimmed query has stayed the same for 0.3 seconds, it calls
 * `search` with it and a signal, and keeps the results. A new query, disabling the search, and
 * unmounting abort the search in flight, and a search that settles after its query changed is
 * ignored, even when `search` doesn't stop on the signal. The previous results stay while the next
 * search runs, and an empty query or a disabled search clears everything.
 * @param options The query, whether to search, and the function that searches.
 * @returns The results, whether a search is waiting or running, its error, and `retry`.
 * @example
 * import { useDebouncedSearch } from 'jg-react';
 *
 * export const useArticleSearch = (query: string) =>
 *   useDebouncedSearch({
 *     query,
 *     search: async (text, signal) => {
 *       const response = await fetch(`/api/articles?q=${encodeURIComponent(text)}`, { signal });
 *       return (await response.json()) as { id: string; title: string }[];
 *     },
 *   });
 */
export const useDebouncedSearch = <TResult>({
  query,
  enabled = true,
  search,
}: IUseDebouncedSearchOptions<TResult>): IUseDebouncedSearchResult<TResult> => {
  const [settled, setSettled] = useState<ISettledSearch>(NO_SEARCH);
  const [attempt, setAttempt] = useState(0);
  const trimmedQuery = query.trim();
  const isActive = enabled && trimmedQuery.length > 0;
  const key = `${String(attempt)}:${trimmedQuery}`;
  // the latest search function, without restarting the debounce when its identity changes
  const runSearch = useEffectEvent((text: string, signal: AbortSignal) => search(text, signal));

  useEffect(() => {
    if (!isActive) {
      setSettled(NO_SEARCH);
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      // a search that throws before returning a promise counts as a rejected one
      void (async () => {
        try {
          const results = await runSearch(trimmedQuery, controller.signal);
          if (!controller.signal.aborted) {
            setSettled({ key, results, error: null });
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setSettled({ key, results: undefined, error });
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isActive, key, trimmedQuery]);

  const retry = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  return {
    results: isActive ? (settled.results as TResult | undefined) : undefined,
    isSearching: isActive && settled.key !== key,
    error: isActive && settled.key === key ? settled.error : null,
    retry,
  };
};
