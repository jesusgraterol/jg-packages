/*
 * TanStack Query schedules no interval where window is undefined, so these run in a browser. Only
 * the interval is faked: TanStack's notifications and React's renders run on real timers, which
 * the tests wait on.
 */
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
} from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { FIRST_PAGE_POLL_KEY } from './constants.js';
import { usePolledFirstPage } from './first-page-poll.hook.js';

type IEvent = { id: string; title: string };
type IEventPage = { data: IEvent[]; nextCursor: string | null };

const QUERY_KEY = ['events'];

const getEventId = (event: IEvent): string => event.id;

let client: QueryClient;
// what the server answers for each cursor, which a test changes between reads
let serverPages: Record<string, IEventPage>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  serverPages = {
    first: {
      data: [
        { id: 'b', title: 'B' },
        { id: 'a', title: 'A' },
      ],
      nextCursor: 'cursor-1',
    },
    'cursor-1': { data: [{ id: 'z', title: 'Z' }], nextCursor: null },
  };
});

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
  client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.useRealTimers();
});

/**
 * Reads a page the way the server answers it.
 * @param cursor The page's cursor, or null for the first page.
 * @returns A promise that resolves to the page.
 */
const readPage = (cursor: string | null): Promise<IEventPage> =>
  Promise.resolve(serverPages[cursor ?? 'first'] as IEventPage);

/**
 * Renders a paged list of events that polls its first page.
 * @param options The interval, and whether to poll.
 * @returns The list's query, and the poll's reads of the first page.
 */
const renderEvents = ({ intervalSeconds = 10, isEnabled = true } = {}) => {
  const readFirstPage = vi.fn((signal: AbortSignal) => {
    expect(signal).toBeInstanceOf(AbortSignal);
    return readPage(null);
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const hook = renderHook(
    () => {
      const events = useInfiniteQuery({
        queryKey: QUERY_KEY,
        queryFn: ({ pageParam }) => readPage(pageParam),
        initialPageParam: null as string | null,
        getNextPageParam: (page) => page.nextCursor,
      });
      usePolledFirstPage({
        queryKey: QUERY_KEY,
        list: events,
        readFirstPage,
        getRowId: getEventId,
        intervalSeconds,
        isEnabled,
      });
      return events;
    },
    { wrapper },
  );
  return { ...hook, readFirstPage };
};

describe('usePolledFirstPage', () => {
  test('reads only the first page each interval, merging it ahead of every page the list loaded', async () => {
    const { result, readFirstPage } = renderEvents();
    await vi.waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(1);
    });
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await vi.waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });
    // opening the list reads its first page once, through the list itself
    expect(readFirstPage).not.toHaveBeenCalled();

    serverPages['first'] = {
      data: [
        { id: 'c', title: 'C' },
        { id: 'b', title: 'B, edited' },
        { id: 'a', title: 'A' },
      ],
      nextCursor: 'cursor-2',
    };
    await act(() => vi.advanceTimersByTimeAsync(10_000));

    await vi.waitFor(() => {
      expect(result.current.data).toStrictEqual({
        pages: [
          {
            data: [
              { id: 'c', title: 'C' },
              { id: 'b', title: 'B, edited' },
              { id: 'a', title: 'A' },
            ],
            nextCursor: 'cursor-1',
          },
          { data: [{ id: 'z', title: 'Z' }], nextCursor: null },
        ],
        pageParams: [null, 'cursor-1'],
      });
    });
    expect(readFirstPage).toHaveBeenCalledOnce();

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    await vi.waitFor(() => {
      expect(readFirstPage).toHaveBeenCalledTimes(2);
    });
    expect(result.current.data?.pages[0]?.data).toHaveLength(3);
  });

  test("doesn't poll while it's disabled", async () => {
    const { result, readFirstPage } = renderEvents({ isEnabled: false });
    await vi.waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(1);
    });

    await act(() => vi.advanceTimersByTimeAsync(60_000));

    expect(readFirstPage).not.toHaveBeenCalled();
  });

  test('drops the poll once the list unmounts, so a later list starts from its own first page', async () => {
    const { result, unmount } = renderEvents();
    await vi.waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(1);
    });
    const findPolls = () => client.getQueryCache().findAll({ queryKey: [FIRST_PAGE_POLL_KEY] });
    // the poll created before the list read its first page goes as soon as the ready one replaces it
    await vi.waitFor(() => {
      expect(findPolls()).toHaveLength(1);
    });

    unmount();

    await vi.waitFor(() => {
      expect(findPolls()).toHaveLength(0);
    });
  });

  test.each([[0], [-1], [Number.NaN]])(
    'usePolledFirstPage({ intervalSeconds: %s }) -> throws',
    (intervalSeconds) => {
      expectToThrowCode(
        () => renderEvents({ intervalSeconds }),
        ERRORS.INVALID_POLLING_INTERVAL,
        'The polling interval must be positive, finite seconds.',
      );
    },
  );
});
