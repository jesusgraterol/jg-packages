// what useDebouncedSearch takes
export type IUseDebouncedSearchOptions<TResult> = {
  // what the user typed; it's trimmed, and an empty query searches nothing
  query: string;

  // whether to search at all, such as while a search dialog is open. Defaults to true
  enabled?: boolean | undefined;

  // runs one search, and should stop when the signal aborts, which happens when the query changes,
  // the search is disabled, or the component unmounts
  search: (query: string, signal: AbortSignal) => Promise<TResult>;
};

// what useDebouncedSearch gives
export type IUseDebouncedSearchResult<TResult> = {
  // the last search's results, kept while the next one runs, or undefined before the first, after
  // a failed one, and while the query is empty or the search is disabled
  results: TResult | undefined;

  // whether a search for the current query is waiting or running
  isSearching: boolean;

  // what the current query's search rejected with, or null
  error: unknown;

  // searches the current query again, such as from a Retry button after an error
  retry: () => void;
};
