import type { InfiniteData, QueryKey } from '@tanstack/react-query';

// a page of a paged list: its rows, and whatever else it carries, such as the next page's cursor
export type IRowPage = { data: readonly unknown[] };

// a page's row
export type IPageRow<TPage extends IRowPage> = TPage['data'][number];

// what usePolledFirstPage takes
export type IUsePolledFirstPageOptions<TPage extends IRowPage> = {
  // the key of the list's infinite query, whose loaded pages each polled first page merges into
  queryKey: QueryKey;

  // the list's infinite query, as useInfiniteQuery returns it
  list: { data: InfiniteData<TPage, unknown> | undefined; dataUpdatedAt: number };

  // reads the list's first page, aborting when the signal does
  readFirstPage: (signal: AbortSignal) => Promise<TPage>;

  // gives a row's ID, the same for every read of the row
  getRowId: (row: IPageRow<TPage>) => string;

  // the seconds between reads, positive and finite
  intervalSeconds: number;

  // whether to poll, such as only while the list is shown. Defaults to true
  isEnabled?: boolean | undefined;
};
