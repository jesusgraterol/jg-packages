import { QueryClient, QueryClientProvider, type QueryMeta } from '@tanstack/react-query';
import { act, createElement, useLayoutEffect, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { useSeededInfiniteQuery } from './seeded-infinite-query.hook.js';
import type { ISeededInfiniteQueryResult } from './types.js';

type IPage = { items: string[]; nextCursor: string | null };

type IResult = ISeededInfiniteQueryResult<IPage, string | null>;

type IHarnessProps = {
  continuationQueryFn: (pageParam: string | null, signal: AbortSignal) => Promise<IPage>;
  firstPageUpdatedAt: number;
  firstPage: IPage | undefined;
  onResult: (result: IResult) => void;
  queryKey?: readonly unknown[];
  gcTimeSeconds?: number;
  maxPages?: number;
  meta?: QueryMeta;
};

const FIRST_PAGE = { items: ['first'], nextCursor: 'cursor-1' } satisfies IPage;
const SECOND_PAGE = { items: ['second'], nextCursor: 'cursor-2' } satisfies IPage;
const FINAL_PAGE = { items: ['final'], nextCursor: null } satisfies IPage;

// tells React the tests wrap their updates in act, so it warns about none
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Renders nothing, and hands each committed result to onResult.
 * @param props The hook's options and the result's receiver.
 * @returns Nothing to render.
 */
const SeededQueryHarness = ({
  continuationQueryFn,
  firstPageUpdatedAt,
  firstPage,
  onResult,
  queryKey = ['seeded-projection'],
  gcTimeSeconds,
  maxPages,
  meta,
}: IHarnessProps): ReactElement | null => {
  const result = useSeededInfiniteQuery<IPage, string | null>({
    continuationQueryFn,
    firstPage,
    getNextPageParam: (page) => page.nextCursor,
    initialPageParam: null,
    queryKey,
    firstPageUpdatedAt,
    gcTimeSeconds,
    maxPages,
    meta,
  });
  useLayoutEffect(() => onResult(result), [onResult, result]);
  return null;
};

/**
 * Creates a promise the test settles.
 * @returns The promise and its resolve and reject functions.
 */
const createDeferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

describe('useSeededInfiniteQuery', () => {
  let container: HTMLDivElement;
  let continuationQueryFn: ReturnType<
    typeof vi.fn<(pageParam: string | null, signal: AbortSignal) => Promise<IPage>>
  >;
  let onResult: ReturnType<typeof vi.fn<(result: IResult) => void>>;
  let queryClient: QueryClient;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    continuationQueryFn = vi.fn();
    onResult = vi.fn();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    queryClient.clear();
    container.remove();
    vi.restoreAllMocks();
  });

  /**
   * Renders the harness with the default first page, and the given changes.
   * @param props What to change.
   */
  const renderHarness = async (props: Partial<IHarnessProps> = {}): Promise<void> => {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(SeededQueryHarness, {
            continuationQueryFn,
            firstPageUpdatedAt: 1,
            firstPage: FIRST_PAGE,
            onResult,
            ...props,
          }),
        ),
      );
      await Promise.resolve();
    });
  };

  /**
   * Gives the last committed result.
   * @returns The result.
   */
  const getResult = (): IResult => {
    const result = onResult.mock.lastCall?.[0];
    if (result === undefined) {
      throw new Error('The harness did not commit.');
    }
    return result;
  };

  test('publishes the first page without fetching it', async () => {
    await renderHarness();

    expect(getResult()).toMatchObject({
      data: { pages: [FIRST_PAGE], pageParams: [null] },
      hasNextPage: true,
      isReady: true,
      isSuccess: true,
    });
    expect(continuationQueryFn).not.toHaveBeenCalled();
  });

  test('keeps a bounded projection after unmount, with its meta but never persisted', async () => {
    const privateReadIdentity = { projectId: 'project', scopeKey: 'scope' };
    continuationQueryFn.mockImplementation((cursor) =>
      Promise.resolve({ items: [cursor ?? ''], nextCursor: `next-${String(cursor)}` }),
    );
    await renderHarness({
      gcTimeSeconds: 300,
      maxPages: 4,
      meta: { persist: true, privateReadIdentity },
    });
    for (let index = 0; index < 5; index += 1) {
      await act(async () => void (await getResult().fetchNextPage()));
      await vi.waitFor(() => expect(continuationQueryFn).toHaveBeenCalledTimes(index + 1));
      await vi.waitFor(() =>
        expect(getResult().data).toStrictEqual(queryClient.getQueryData(['seeded-projection'])),
      );
    }
    expect(getResult().data?.pages).toHaveLength(4);
    const retained = getResult().data;
    const query = queryClient
      .getQueryCache()
      .find({ queryKey: ['seeded-projection'], exact: true });
    expect(query?.meta).toStrictEqual({ persist: false, privateReadIdentity });
    expect(query?.gcTime).toBe(300_000);

    act(() => {
      root.render(null);
    });
    expect(queryClient.getQueryData(['seeded-projection'])).toStrictEqual(retained);
    await renderHarness({ gcTimeSeconds: 300, maxPages: 4, meta: { privateReadIdentity } });
    expect(getResult().data).toStrictEqual(retained);
    expect(continuationQueryFn).toHaveBeenCalledTimes(5);
  });

  test('loads only explicit continuations, and keeps fetchNextPage and refetch stable', async () => {
    continuationQueryFn.mockResolvedValueOnce(SECOND_PAGE).mockResolvedValueOnce(FINAL_PAGE);
    await renderHarness();
    const firstResult = getResult();

    await act(async () => void (await firstResult.fetchNextPage()));
    await vi.waitFor(() => expect(getResult().data?.pages).toHaveLength(2));
    await act(async () => void (await getResult().fetchNextPage()));
    await vi.waitFor(() => expect(getResult().data?.pages).toHaveLength(3));
    const finalResult = getResult();

    expect(continuationQueryFn.mock.calls.map(([cursor]) => cursor)).toStrictEqual([
      'cursor-1',
      'cursor-2',
    ]);
    expect(finalResult.data).toStrictEqual({
      pages: [FIRST_PAGE, SECOND_PAGE, FINAL_PAGE],
      pageParams: [null, 'cursor-1', 'cursor-2'],
    });
    expect(finalResult.hasNextPage).toBe(false);
    expect(finalResult.fetchNextPage).toBe(firstResult.fetchNextPage);
    expect(finalResult.refetch).toBe(firstResult.refetch);
    // without a next page, fetchNextPage fetches nothing
    await act(async () => void (await finalResult.fetchNextPage()));
    expect(continuationQueryFn).toHaveBeenCalledTimes(2);
  });

  test('retries only the failed continuation, keeping the pages it has', async () => {
    const failure = new Error('continuation unavailable');
    continuationQueryFn
      .mockResolvedValueOnce(SECOND_PAGE)
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(FINAL_PAGE);
    await renderHarness();
    // without an error, refetch fetches nothing
    await act(async () => void (await getResult().refetch()));
    await act(async () => void (await getResult().fetchNextPage()));
    await act(async () => void (await getResult().fetchNextPage()));
    await vi.waitFor(() => expect(getResult().isError).toBe(true));

    expect(getResult()).toMatchObject({
      data: { pages: [FIRST_PAGE, SECOND_PAGE] },
      error: failure,
      isError: true,
    });

    await act(async () => void (await getResult().refetch()));
    await vi.waitFor(() => expect(getResult().isError).toBe(false));

    expect(continuationQueryFn.mock.calls.map(([cursor]) => cursor)).toStrictEqual([
      'cursor-1',
      'cursor-2',
      'cursor-2',
    ]);
    expect(getResult()).toMatchObject({
      data: { pages: [FIRST_PAGE, SECOND_PAGE, FINAL_PAGE] },
      error: null,
      isError: false,
    });
  });

  test('blocks continuations and stale data until the generation is published', async () => {
    const cancellation = createDeferred<undefined>();
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValueOnce(cancellation.promise);

    await renderHarness();
    expect(getResult()).toMatchObject({ data: undefined, isReady: false, isLoading: true });
    await act(async () => void (await getResult().fetchNextPage()));
    expect(continuationQueryFn).not.toHaveBeenCalled();

    cancellation.resolve(undefined);
    await act(async () => void (await cancellation.promise));
    expect(getResult()).toMatchObject({ data: { pages: [FIRST_PAGE] }, isReady: true });
  });

  test('drops a delayed continuation of the same key once a newer generation arrives', async () => {
    const continuation = createDeferred<IPage>();
    let continuationSignal: AbortSignal | undefined;
    continuationQueryFn.mockImplementationOnce((_pageParam, signal) => {
      continuationSignal = signal;
      return continuation.promise;
    });
    await renderHarness();
    void getResult().fetchNextPage();
    await vi.waitFor(() => expect(continuationQueryFn).toHaveBeenCalledTimes(1));

    const replacement = { items: ['replacement'], nextCursor: null } satisfies IPage;
    await renderHarness({ firstPageUpdatedAt: 2, firstPage: replacement });
    expect(continuationSignal?.aborted).toBe(true);
    continuation.resolve(SECOND_PAGE);
    await act(async () => void (await continuation.promise));

    expect(getResult().data).toStrictEqual({ pages: [replacement], pageParams: [null] });
  });

  test('keeps an older delayed publication from replacing the latest generation', async () => {
    const firstCancellation = createDeferred<undefined>();
    vi.spyOn(queryClient, 'cancelQueries')
      .mockReturnValueOnce(firstCancellation.promise)
      .mockResolvedValueOnce();
    await renderHarness();

    const replacement = { items: ['latest'], nextCursor: null } satisfies IPage;
    await renderHarness({ firstPageUpdatedAt: 2, firstPage: replacement });
    expect(getResult().data).toStrictEqual({ pages: [replacement], pageParams: [null] });

    firstCancellation.resolve(undefined);
    await act(async () => void (await firstCancellation.promise));
    expect(getResult().data).toStrictEqual({ pages: [replacement], pageParams: [null] });
  });

  test('keeps a shared projection and its continuation alive when one observer unmounts', async () => {
    const queryKey = ['seeded-projection', 'shared'] as const;
    const continuation = createDeferred<IPage>();
    let continuationSignal: AbortSignal | undefined;
    continuationQueryFn.mockImplementationOnce((_pageParam, signal) => {
      continuationSignal = signal;
      return continuation.promise;
    });
    const firstObserver = vi.fn<(result: IResult) => void>();
    const secondObserver = vi.fn<(result: IResult) => void>();
    const renderObservers = async (includeFirst: boolean): Promise<void> => {
      await act(async () => {
        root.render(
          createElement(QueryClientProvider, { client: queryClient }, [
            includeFirst
              ? createElement(SeededQueryHarness, {
                  key: 'first',
                  continuationQueryFn,
                  firstPageUpdatedAt: 1,
                  firstPage: FIRST_PAGE,
                  onResult: firstObserver,
                  queryKey,
                })
              : null,
            createElement(SeededQueryHarness, {
              key: 'second',
              continuationQueryFn,
              firstPageUpdatedAt: 1,
              firstPage: FIRST_PAGE,
              onResult: secondObserver,
              queryKey,
            }),
          ]),
        );
        await Promise.resolve();
      });
    };

    await renderObservers(true);
    await vi.waitFor(() => expect(firstObserver.mock.lastCall?.[0].isReady).toBe(true));
    const pendingContinuation = firstObserver.mock.lastCall?.[0].fetchNextPage();
    await vi.waitFor(() => expect(continuationQueryFn).toHaveBeenCalledTimes(1));

    await renderObservers(false);
    expect(continuationSignal?.aborted).toBe(false);
    expect(queryClient.getQueryData(queryKey)).toStrictEqual({
      pages: [FIRST_PAGE],
      pageParams: [null],
    });

    continuation.resolve(SECOND_PAGE);
    await act(async () => void (await pendingContinuation));
    await vi.waitFor(() =>
      expect(secondObserver.mock.lastCall?.[0].data).toStrictEqual({
        pages: [FIRST_PAGE, SECOND_PAGE],
        pageParams: [null, 'cursor-1'],
      }),
    );
  });

  test('lets a late observer adopt a shared generation without resetting its pages', async () => {
    const queryKey = ['seeded-projection', 'late-observer'] as const;
    const continuation = createDeferred<IPage>();
    let continuationSignal: AbortSignal | undefined;
    continuationQueryFn
      .mockResolvedValueOnce(SECOND_PAGE)
      .mockImplementationOnce((_pageParam, signal) => {
        continuationSignal = signal;
        return continuation.promise;
      });
    const firstObserver = vi.fn<(result: IResult) => void>();
    const secondObserver = vi.fn<(result: IResult) => void>();
    const renderObservers = async (includeSecond: boolean): Promise<void> => {
      await act(async () => {
        root.render(
          createElement(QueryClientProvider, { client: queryClient }, [
            createElement(SeededQueryHarness, {
              key: 'first',
              continuationQueryFn,
              firstPageUpdatedAt: 1,
              firstPage: FIRST_PAGE,
              onResult: firstObserver,
              queryKey,
            }),
            includeSecond
              ? createElement(SeededQueryHarness, {
                  key: 'second',
                  continuationQueryFn,
                  firstPageUpdatedAt: 1,
                  firstPage: FIRST_PAGE,
                  onResult: secondObserver,
                  queryKey,
                })
              : null,
          ]),
        );
        await Promise.resolve();
      });
    };

    await renderObservers(false);
    await vi.waitFor(() => expect(firstObserver.mock.lastCall?.[0].isReady).toBe(true));
    await act(async () => void (await firstObserver.mock.lastCall?.[0].fetchNextPage()));
    await vi.waitFor(() => expect(firstObserver.mock.lastCall?.[0].data?.pages).toHaveLength(2));

    const pendingContinuation = firstObserver.mock.lastCall?.[0].fetchNextPage();
    await vi.waitFor(() => expect(continuationQueryFn).toHaveBeenCalledTimes(2));
    await renderObservers(true);

    expect(continuationSignal?.aborted).toBe(false);
    expect(secondObserver.mock.lastCall?.[0].data).toStrictEqual({
      pages: [FIRST_PAGE, SECOND_PAGE],
      pageParams: [null, 'cursor-1'],
    });

    continuation.resolve(FINAL_PAGE);
    await act(async () => void (await pendingContinuation));
    await vi.waitFor(() =>
      expect(secondObserver.mock.lastCall?.[0].data).toStrictEqual({
        pages: [FIRST_PAGE, SECOND_PAGE, FINAL_PAGE],
        pageParams: [null, 'cursor-1', 'cursor-2'],
      }),
    );
  });

  test('publishes an empty final page, and publishes again after the cache drops it', async () => {
    const emptyPage = { items: [], nextCursor: null } satisfies IPage;
    const queryKey = ['seeded-projection', 'empty'] as const;
    await renderHarness({ firstPage: emptyPage, queryKey });

    expect(getResult()).toMatchObject({
      data: { pages: [emptyPage], pageParams: [null] },
      hasNextPage: false,
    });

    act(() => {
      root.unmount();
    });
    await vi.waitFor(() => expect(queryClient.getQueryData(queryKey)).toBeUndefined());

    onResult.mockClear();
    root = createRoot(container);
    await renderHarness({ firstPage: emptyPage, queryKey });
    expect(getResult()).toMatchObject({
      data: { pages: [emptyPage], pageParams: [null] },
      isReady: true,
    });
  });

  test('rejects with FIRST_PAGE_NOT_READY when something forces a fetch before the first page', async () => {
    const queryKey = ['seeded-projection', 'not-ready'] as const;
    await renderHarness({ firstPage: undefined, firstPageUpdatedAt: 0, queryKey });

    expect(getResult()).toMatchObject({ data: undefined, isReady: false, isPending: true });
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    await expect(query?.fetch()).rejects.toMatchObject({
      code: ERRORS.FIRST_PAGE_NOT_READY,
      message: "The first page isn't ready yet.",
    });
    expect(continuationQueryFn).not.toHaveBeenCalled();
  });
});
