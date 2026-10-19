// @vitest-environment node
import { describe, expect, test } from 'vitest';

import type { IInitialResolution, IQueryBoundaryQuery, IQueryBoundaryState } from './types.js';
import {
  advanceInitialResolution,
  createInitialResolution,
  deriveBoundaryOutputs,
  readBoundarySignals,
  reuseIfSameQueries,
} from './utilities.js';

// what a render shows, without the failed queries' objects
type IShown = Pick<
  IQueryBoundaryState<IQueryBoundaryQuery>,
  'canRenderContent' | 'isLoaderVisible' | 'hasError' | 'errorPresentation'
> & { hasLoadMore: boolean; failedCount: number };

// one render of a boundary: its queries, its key, and whether the app approved the key's data
type IStep = { queries: IQueryBoundaryQuery[]; key?: string; isApproved?: boolean };

// an error that the tests' access check reads as a lost access
const ACCESS_DENIED = { code: 'ACCESS_DENIED' };

/**
 * Builds a fresh, settled query with data, and the given changes.
 * @param overrides What to change.
 * @returns The query.
 */
const createQuery = (overrides: Partial<IQueryBoundaryQuery> = {}): IQueryBoundaryQuery => ({
  data: 'Current records',
  error: null,
  isError: false,
  isFetchedAfterMount: true,
  isFetching: false,
  isLoading: false,
  isPending: false,
  isRefetching: false,
  isStale: false,
  ...overrides,
});

/**
 * Builds a query that pages, with the given changes.
 * @param overrides What to change.
 * @returns The query.
 */
const createPagingQuery = (overrides: Partial<IQueryBoundaryQuery> = {}): IQueryBoundaryQuery =>
  createQuery({
    fetchNextPage: () => undefined,
    hasNextPage: true,
    isFetchingNextPage: false,
    ...overrides,
  });

/**
 * Reduces outputs to what the tables compare.
 * @param outputs The outputs.
 * @returns What they show.
 */
const toShown = ({
  canRenderContent,
  isLoaderVisible,
  hasError,
  errorPresentation,
  loadMoreQuery,
  failedQueries,
}: Omit<IQueryBoundaryState<IQueryBoundaryQuery>, 'retryFailed'>): IShown => ({
  canRenderContent,
  isLoaderVisible,
  hasError,
  errorPresentation,
  hasLoadMore: loadMoreQuery !== undefined,
  failedCount: failedQueries.length,
});

/**
 * Replays renders the way the hook runs them: each render derives its outputs from the committed
 * resolution, then its effect commits the transition, and the boundary renders again.
 * @param steps The renders.
 * @returns What each render showed, and what it showed once its effect committed.
 */
const replay = (steps: IStep[]): { rendered: IShown; settled: IShown }[] => {
  let resolution: IInitialResolution | undefined;
  return steps.map(({ queries, key = 'records', isApproved = false }) => {
    const signals = readBoundarySignals(queries, (error) => error === ACCESS_DENIED, isApproved);
    resolution ??= createInitialResolution(key, signals);
    const rendered = toShown(deriveBoundaryOutputs(resolution, key, queries, signals));
    resolution = advanceInitialResolution(resolution, key, signals);
    const settled = toShown(deriveBoundaryOutputs(resolution, key, queries, signals));
    return { rendered, settled };
  });
};

// what the tables expect a boundary to show
const LOADING: IShown = {
  canRenderContent: false,
  isLoaderVisible: true,
  hasError: false,
  errorPresentation: 'blocking',
  hasLoadMore: false,
  failedCount: 0,
};
const CONTENT: IShown = {
  canRenderContent: true,
  isLoaderVisible: false,
  hasError: false,
  errorPresentation: 'retained',
  hasLoadMore: false,
  failedCount: 0,
};
const BLOCKING_ERROR: IShown = {
  canRenderContent: false,
  isLoaderVisible: false,
  hasError: true,
  errorPresentation: 'blocking',
  hasLoadMore: false,
  failedCount: 1,
};
const RETAINED_ERROR: IShown = {
  ...CONTENT,
  hasError: true,
  failedCount: 1,
};

describe('query boundary transitions', () => {
  test('shows a loader, and neither content nor load-more, while loading', () => {
    const [step] = replay([
      {
        queries: [
          createPagingQuery({
            data: undefined,
            isFetchedAfterMount: false,
            isLoading: true,
            isPending: true,
          }),
          createQuery(),
        ],
      },
    ]);

    expect(step).toStrictEqual({ rendered: LOADING, settled: LOADING });
  });

  test('hides stale cached data until the refetch after mount settles', () => {
    const stale = createQuery({
      isFetchedAfterMount: false,
      isFetching: true,
      isRefetching: true,
      isStale: true,
    });

    const [first, second] = replay([
      { queries: [stale] },
      {
        queries: [{ ...stale, isFetchedAfterMount: true, isFetching: false, isRefetching: false }],
      },
    ]);

    expect(first).toStrictEqual({ rendered: LOADING, settled: LOADING });
    expect(second?.settled).toStrictEqual(CONTENT);
  });

  test('hides the content in the same render as a key change, until the new key resolves', () => {
    const [first, second] = replay([
      { queries: [createQuery()], key: 'records:first' },
      {
        queries: [
          createQuery({
            isFetchedAfterMount: false,
            isFetching: true,
            isRefetching: true,
            isStale: true,
          }),
        ],
        key: 'records:second',
      },
    ]);

    expect(first?.rendered).toStrictEqual(CONTENT);
    expect(second).toStrictEqual({ rendered: LOADING, settled: LOADING });
  });

  test('shows the content and the first query for load-more once loading settles', () => {
    const [step] = replay([{ queries: [createPagingQuery(), createQuery()] }]);

    expect(step).toStrictEqual({
      rendered: { ...CONTENT, hasLoadMore: true },
      settled: { ...CONTENT, hasLoadMore: true },
    });
  });

  test('keeps the content while an infinite query loads more', () => {
    const [step] = replay([{ queries: [createPagingQuery({ isFetchingNextPage: true })] }]);

    expect(step?.settled).toStrictEqual({ ...CONTENT, hasLoadMore: true });
  });

  test('shows neither content nor load-more when a query fails before the content showed', () => {
    const [step] = replay([
      {
        queries: [
          createPagingQuery(),
          createQuery({ error: new Error('Records could not be loaded.'), isError: true }),
        ],
      },
    ]);

    expect(step).toStrictEqual({ rendered: BLOCKING_ERROR, settled: BLOCKING_ERROR });
  });

  test('keeps the content beside a background failure', () => {
    const [, second] = replay([
      { queries: [createQuery()] },
      { queries: [createQuery({ error: new Error('Refresh failed.'), isError: true })] },
    ]);

    expect(second).toStrictEqual({ rendered: RETAINED_ERROR, settled: RETAINED_ERROR });
  });

  test('keeps approved data beside a failure when the boundary mounts again', () => {
    const [step] = replay([
      {
        queries: [createQuery({ error: new Error('Refresh failed.'), isError: true })],
        isApproved: true,
      },
    ]);

    expect(step).toStrictEqual({ rendered: RETAINED_ERROR, settled: RETAINED_ERROR });
  });

  test('blocks the content when a failed query has no data left', () => {
    const [, second] = replay([
      { queries: [createQuery()] },
      {
        queries: [
          createQuery({ data: undefined, error: new Error('Refresh failed.'), isError: true }),
        ],
      },
    ]);

    expect(second).toStrictEqual({ rendered: BLOCKING_ERROR, settled: BLOCKING_ERROR });
  });

  test("offers no load-more when the first query doesn't page", () => {
    const [step] = replay([{ queries: [createQuery(), createPagingQuery()] }]);

    expect(step?.settled.hasLoadMore).toBe(false);
  });

  test('hides approved content in the same render as an access loss, until every query settles with data', () => {
    const steps = replay([
      { queries: [createQuery()], isApproved: true },
      { queries: [createQuery({ isError: true, error: ACCESS_DENIED })], isApproved: true },
      {
        queries: [createQuery({ isError: true, error: new Error('Network failure.') })],
        isApproved: true,
      },
      { queries: [createQuery({ isPending: true, isFetching: true })], isApproved: true },
      { queries: [createQuery()], isApproved: true },
    ]);

    expect(
      steps.map(({ rendered, settled }) => [rendered.canRenderContent, settled.canRenderContent]),
    ).toStrictEqual([
      [true, true],
      [false, false],
      [false, false],
      [false, false],
      [false, true],
    ]);
    expect(steps[1]?.rendered).toStrictEqual(BLOCKING_ERROR);
  });

  test('keeps the same resolution while access stays lost', () => {
    const lost = readBoundarySignals(
      [createQuery({ isError: true, error: ACCESS_DENIED })],
      (error) => error === ACCESS_DENIED,
      true,
    );
    const resolution = advanceInitialResolution(
      createInitialResolution('records', { ...lost, hasAccessLoss: false }),
      'records',
      lost,
    );

    expect(resolution).toStrictEqual({ key: 'records', isComplete: false, hasLostAccess: true });
    expect(advanceInitialResolution(resolution, 'records', lost)).toBe(resolution);
  });

  test('ignores access errors without an access check', () => {
    const signals = readBoundarySignals(
      [createQuery({ isError: true, error: ACCESS_DENIED })],
      () => false,
      true,
    );

    expect(signals.hasAccessLoss).toBe(false);
  });

  test('returns the same resolution when nothing changes', () => {
    const signals = readBoundarySignals([createQuery()], () => false, false);
    const resolution = createInitialResolution('records', signals);

    expect(advanceInitialResolution(resolution, 'records', signals)).toBe(resolution);
  });
});

describe('reuseIfSameQueries', () => {
  test('keeps the previous list for the same queries, in the same order', () => {
    const first = createQuery();
    const second = createQuery();
    const previous = [first, second];

    expect(reuseIfSameQueries(previous, [first, second])).toBe(previous);
    expect(reuseIfSameQueries(previous, [second, first])).toStrictEqual([second, first]);
    expect(reuseIfSameQueries(previous, [first])).toStrictEqual([first]);
    expect(reuseIfSameQueries([], [])).toStrictEqual([]);
  });
});
