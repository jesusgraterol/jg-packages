import { useEffect, useRef } from 'react';
import { type InfiniteData, useQuery, useQueryClient } from '@tanstack/react-query';

import { createPollingQueryOptions } from '../polling/index.js';

import { FIRST_PAGE_POLL_KEY } from './constants.js';
import type { IRowPage, IUsePolledFirstPageOptions } from './types.js';
import { mergeFirstPage } from './utilities.js';

/**
 * Keeps a paged list fresh by reading only its first page every `intervalSeconds`, and merging
 * each read into the loaded pages by row ID with mergeFirstPage: new rows go ahead, rows the list
 * holds take the new version, and the pages after the first are never read again, so a list that
 * loaded more keeps them and its scroll. It polls as createPollingQueryOptions does: while the tab
 * is visible, the browser is online and the last read succeeded. The poll starts from the page
 * the list read, so opening the list reads its first page once, and it's dropped as soon as the
 * list unmounts, so it's never kept, persisted or merged late.
 * @param options The list's key and query, what reads its first page, the rows' IDs, and the
 * interval.
 * @example
 * import { useInfiniteQuery } from '@tanstack/react-query';
 * import { usePolledFirstPage } from 'jg-tanstack-query';
 *
 * type IEventPage = { data: { id: string; title: string }[]; nextCursor: string | null };
 * declare const fetchEvents: (cursor: string | null, signal: AbortSignal) => Promise<IEventPage>;
 *
 * const getEventId = (event: { id: string }) => event.id;
 *
 * export const useEvents = () => {
 *   const queryKey = ['events'];
 *   const events = useInfiniteQuery({
 *     queryKey,
 *     queryFn: ({ pageParam, signal }) => fetchEvents(pageParam, signal),
 *     initialPageParam: null as string | null,
 *     getNextPageParam: (page) => page.nextCursor,
 *   });
 *   usePolledFirstPage({
 *     queryKey,
 *     list: events,
 *     readFirstPage: (signal) => fetchEvents(null, signal),
 *     getRowId: getEventId,
 *     intervalSeconds: 15,
 *   });
 *   return events;
 * };
 * @throws
 * - INVALID_POLLING_INTERVAL: The polling interval must be positive, finite seconds.
 */
export const usePolledFirstPage = <TPage extends IRowPage>({
  queryKey,
  list,
  readFirstPage,
  getRowId,
  intervalSeconds,
  isEnabled = true,
}: IUsePolledFirstPageOptions<TPage>): void => {
  const pollingOptions = createPollingQueryOptions<TPage>({ intervalSeconds });
  const queryClient = useQueryClient();
  const firstPage = list.data?.pages[0];
  const isReady = isEnabled && firstPage !== undefined;
  // keyed by readiness, so the poll starts only once the list's first page is its data
  const poll = useQuery({
    queryKey: [FIRST_PAGE_POLL_KEY, ...queryKey, isReady],
    queryFn: ({ signal }) => readFirstPage(signal),
    enabled: isReady,
    initialData: () => firstPage,
    initialDataUpdatedAt: list.dataUpdatedAt,
    staleTime: intervalSeconds * 1_000,
    gcTime: 0,
    ...pollingOptions,
  });

  // each page the poll reads is merged once; the list's own first page, its starting data, never is
  const polled = poll.isFetched ? poll.data : undefined;
  const mergedRef = useRef<TPage | undefined>(undefined);
  useEffect(() => {
    if (polled === undefined || polled === mergedRef.current) {
      return;
    }
    mergedRef.current = polled;
    queryClient.setQueryData<InfiniteData<TPage, unknown>>(
      queryKey,
      (data) => data && mergeFirstPage(data, polled, getRowId),
    );
  }, [getRowId, polled, queryClient, queryKey]);
};
