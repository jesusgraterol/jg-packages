import { getByRole } from '@testing-library/dom';
import { renderWithErrorPolicy } from '../../shared/error-feedback/error-feedback.test-utils.js';
import { type ReactElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Exception } from 'jg-exception';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';

import { QueryBoundary, type IQueryBoundaryQuery } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const QUERY_BOUNDARY_INTEGRATION_QUERY_KEY = ['query-boundary-integration'];

type IDeferred<TValue> = {
  promise: Promise<TValue>;
  resolve: (value: TValue) => void;
};

/** Creates a controllable promise for query lifecycle tests. */
const createDeferred = <TValue,>(): IDeferred<TValue> => {
  let resolvePromise: (value: TValue) => void = () => undefined;
  const promise = new Promise<TValue>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

type IQueryBoundaryHarnessProps = {
  queryFn: () => Promise<string>;
};

/** Renders QueryBoundary with a real stale-immediately TanStack query. */
const QueryBoundaryHarness = ({ queryFn }: IQueryBoundaryHarnessProps): ReactElement => {
  const query = useQuery({
    queryFn,
    queryKey: QUERY_BOUNDARY_INTEGRATION_QUERY_KEY,
    staleTime: 0,
  });

  return (
    <QueryBoundary
      queries={[query]}
      resolutionKey="query-boundary-integration"
    >
      <p>{query.data}</p>
      <button
        type="button"
        onClick={() => {
          void query.refetch();
        }}
      >
        Refresh records
      </button>
    </QueryBoundary>
  );
};

/**
 * Creates a query-like object for QueryBoundary scenarios.
 * @param overrides The query fields to override for a scenario.
 * @returns The query-like object consumed by QueryBoundary.
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
  refetch: vi.fn<() => Promise<{ isError: boolean }>>().mockResolvedValue({
    isError: false,
  }),
  ...overrides,
});

/**
 * Creates a query-like object that supports LoadMoreButton pagination.
 * @param overrides The query pagination fields to override for a scenario.
 * @returns The paginated query-like object consumed by QueryBoundary.
 */
const createPaginationQuery = (
  overrides: Partial<IQueryBoundaryQuery> = {},
): IQueryBoundaryQuery => ({
  fetchNextPage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  hasNextPage: true,
  isFetchingNextPage: false,
  ...createQuery(),
  ...overrides,
});

describe('QueryBoundary', () => {
  let queryClient: QueryClient;
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => {
      root.unmount();
    });

    queryClient.clear();
    container.remove();
    vi.clearAllMocks();

    await Promise.resolve();
  });

  test('renders loader while hiding children and load-more during initial loading', async () => {
    const firstQuery = createPaginationQuery({
      data: undefined,
      isFetchedAfterMount: false,
      isLoading: true,
      isPending: true,
    });
    const secondQuery = createQuery();

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          errorAlertProps={{
            title: 'Records unavailable',
          }}
          loaderProps={{
            'aria-label': 'Loading records',
            layout: 'page',
          }}
          loadMoreButtonProps={{
            'aria-label': 'Load more records',
          }}
          queries={[firstQuery, secondQuery]}
        >
          <section aria-label="Records">Visible records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    const queryErrorAlert = container.querySelector('[data-slot="query-error-alert"]');
    const queryLoader = container.querySelector('[data-slot="query-loader"]');
    const loadMoreButton = container.querySelector<HTMLButtonElement>(
      '[data-slot="load-more-button"]',
    );

    expect(queryErrorAlert).toBe(null);
    expect(queryLoader?.getAttribute('aria-label')).toBe('Loading records');
    expect(queryLoader?.getAttribute('data-layout')).toBe('page');
    expect(container.textContent).not.toContain('Visible records');
    expect(loadMoreButton).toBe(null);
  });

  test('hides stale cached children until the initial refetch settles', async () => {
    const staleQuery = createQuery({
      isFetchedAfterMount: false,
      isFetching: true,
      isRefetching: true,
      isStale: true,
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[staleQuery]}
          resolutionKey="records"
        >
          <section aria-label="Records">Stale cached records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    expect(container.querySelector('[data-slot="query-loader"]')).not.toBe(null);
    expect(container.textContent).not.toContain('Stale cached records');

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          queries={[
            {
              ...staleQuery,
              isFetchedAfterMount: true,
              isFetching: false,
              isRefetching: false,
            },
          ]}
        >
          <section aria-label="Records">Current records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
    expect(container.textContent).toContain('Current records');
  });

  test('restarts initial resolution when the logical query key changes', async () => {
    const firstQuery = createQuery();

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[firstQuery]}
          resolutionKey="records:first"
        >
          <section aria-label="Records">First records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    expect(container.textContent).toContain('First records');

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[
            createQuery({
              isFetchedAfterMount: false,
              isFetching: true,
              isRefetching: true,
              isStale: true,
            }),
          ]}
          resolutionKey="records:second"
        >
          <section aria-label="Records">Stale second records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    expect(container.querySelector('[data-slot="query-loader"]')).not.toBe(null);
    expect(container.textContent).not.toContain('Stale second records');
  });

  test('integrates with TanStack query freshness without hiding later refetches', async () => {
    const initialFetch = createDeferred<string>();
    const laterFetch = createDeferred<string>();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => initialFetch.promise)
      .mockImplementationOnce(() => laterFetch.promise);

    queryClient.setQueryData<string>(QUERY_BOUNDARY_INTEGRATION_QUERY_KEY, 'Stale records');

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryClientProvider client={queryClient}>
          <QueryBoundaryHarness queryFn={queryFn} />
        </QueryClientProvider>,
      );

      await Promise.resolve();
    });

    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-slot="query-loader"]')).not.toBe(null);
    expect(container.textContent).not.toContain('Stale records');

    await act(async () => {
      initialFetch.resolve('Current records');
      await initialFetch.promise;
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Current records');
    });

    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);

    const refreshButton = container.querySelector<HTMLButtonElement>('button');

    if (refreshButton === null) {
      throw new Error('Refresh button was not found.');
    }

    await act(async () => {
      refreshButton.click();
      await Promise.resolve();
    });

    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
    expect(container.textContent).toContain('Current records');

    await act(async () => {
      laterFetch.resolve('Updated records');
      await laterFetch.promise;
    });
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Updated records');
    });
  });

  test('renders children and first-query load-more behavior after initial loading settles', async () => {
    const firstQuery = createPaginationQuery();
    const secondQuery = createQuery();

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          loadMoreButtonProps={{
            'aria-label': 'Load more records',
          }}
          queries={[firstQuery, secondQuery]}
        >
          <section aria-label="Records">Visible records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    const loadMoreButton = container.querySelector<HTMLButtonElement>(
      '[data-slot="load-more-button"]',
    );

    expect(container.textContent).toContain('Visible records');
    expect(loadMoreButton?.getAttribute('aria-label')).toBe('Load more records');

    await act(async () => {
      loadMoreButton?.click();

      await Promise.resolve();
    });

    expect(firstQuery.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('keeps children visible while an infinite query is loading more records', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          loadMoreButtonProps={{
            'aria-label': 'Load more records',
            loadingAriaLabel: 'Loading more records',
          }}
          queries={[
            createPaginationQuery({
              isFetchingNextPage: true,
            }),
          ]}
        >
          <section aria-label="Records">Visible records</section>
        </QueryBoundary>,
      );
    });

    const loadMoreButton = container.querySelector<HTMLButtonElement>(
      '[data-slot="load-more-button"]',
    );

    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
    expect(container.textContent).toContain('Visible records');
    expect(loadMoreButton?.getAttribute('aria-busy')).toBe('true');
    expect(loadMoreButton?.getAttribute('aria-label')).toBe('Loading more records');
    expect(loadMoreButton?.disabled).toBe(true);
  });

  test('does not render children or load-more when any query has failed', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          errorAlertProps={{
            title: 'Records unavailable',
          }}
          loadMoreButtonProps={{
            'aria-label': 'Load more records',
          }}
          queries={[
            createPaginationQuery(),
            createQuery({
              error: new Exception('Records could not be loaded.', { code: 'RECORDS_FAILED' }),
              isError: true,
            }),
          ]}
        >
          <section aria-label="Records">Stale records</section>
        </QueryBoundary>,
      );
    });

    const queryErrorAlert = container.querySelector('[data-slot="query-error-alert"]');

    expect(queryErrorAlert?.textContent).toContain('Records unavailable');
    expect(container.textContent).not.toContain('Stale records');
    expect(container.querySelector('[data-slot="load-more-button"]')).toBe(null);
  });

  test('retains current-resolution data and compact feedback after a background failure', async () => {
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[createQuery()]}
          resolutionKey="records"
        >
          <section aria-label="Records">Current records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[
            createQuery({
              error: new Exception('Refresh failed.', { code: 'REFRESH_FAILED' }),
              isError: true,
            }),
          ]}
          resolutionKey="records"
        >
          <section aria-label="Records">Current records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    const queryErrorAlert = container.querySelector('[data-slot="query-error-alert"]');

    expect(queryErrorAlert?.getAttribute('data-presentation')).toBe('retained');
    expect(container.textContent).toContain('Current records');
    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
  });

  test('retains externally approved data when the boundary remounts during a failure', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          isInitialResolutionApproved
          queries={[
            createQuery({
              error: new Exception('Refresh failed.', { code: 'REFRESH_FAILED' }),
              isError: true,
            }),
          ]}
          resolutionKey="records"
        >
          <section aria-label="Records">Approved records</section>
        </QueryBoundary>,
      );
    });

    expect(
      container.querySelector('[data-slot="query-error-alert"]')?.getAttribute('data-presentation'),
    ).toBe('retained');
    expect(container.textContent).toContain('Approved records');
  });

  test('blocks content when a failed query no longer has retained data', async () => {
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[createQuery()]}
          resolutionKey="records"
        >
          <section aria-label="Records">Current records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[
            createQuery({
              data: undefined,
              error: new Exception('Refresh failed.', { code: 'REFRESH_FAILED' }),
              isError: true,
            }),
          ]}
          resolutionKey="records"
        >
          <section aria-label="Records">Current records</section>
        </QueryBoundary>,
      );

      await Promise.resolve();
    });

    const queryErrorAlert = container.querySelector('[data-slot="query-error-alert"]');

    expect(queryErrorAlert?.getAttribute('data-presentation')).toBe('blocking');
    expect(container.textContent).not.toContain('Current records');
  });

  test('does not render load-more when the first query does not support pagination', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          loadMoreButtonProps={{
            'aria-label': 'Load more records',
          }}
          queries={[createQuery()]}
        />,
      );
    });

    expect(container.querySelector('[data-slot="load-more-button"]')).toBe(null);
  });

  test('supports disabling default feedback slots', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          errorAlertProps={false}
          loaderProps={false}
          loadMoreButtonProps={false}
          queries={[createPaginationQuery()]}
        >
          <section aria-label="Records">Records only</section>
        </QueryBoundary>,
      );
    });

    expect(container.querySelector('[data-slot="query-error-alert"]')).toBe(null);
    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
    expect(container.querySelector('[data-slot="load-more-button"]')).toBe(null);
    expect(container.textContent).toContain('Records only');
  });

  test('supports custom renderers for every feedback slot', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          resolutionKey="records"
          queries={[createPaginationQuery()]}
          renderErrorAlert={(props) => (
            <div data-slot="custom-error-alert">
              {props.queries.length} {props.presentation} error queries
            </div>
          )}
          renderLoader={(props) => (
            <div data-slot="custom-loader">{props.queries.length} loader queries</div>
          )}
          renderLoadMoreButton={(props) => (
            <button
              data-slot="custom-load-more"
              type="button"
              onClick={() => {
                void props.query.fetchNextPage();
              }}
            >
              Custom load more
            </button>
          )}
        />,
      );
    });

    const loadMoreButton = container.querySelector<HTMLButtonElement>(
      '[data-slot="custom-load-more"]',
    );

    expect(container.textContent).toContain('1 retained error queries');
    expect(container.textContent).toContain('1 loader queries');
    expect(loadMoreButton?.textContent).toBe('Custom load more');
  });

  test('clears approved private data when a read confirms access loss', async () => {
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[createQuery()]}
          resolutionKey="private-records"
          isInitialResolutionApproved
        >
          <section aria-label="Private records">Private content</section>
        </QueryBoundary>,
      );
      await Promise.resolve();
    });
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[
            createQuery({
              isError: true,
              error: new Exception('private authorization detail', { code: 'ACCESS_REVOKED' }),
            }),
          ]}
          resolutionKey="private-records"
          isInitialResolutionApproved
        >
          <section aria-label="Private records">Private content</section>
        </QueryBoundary>,
      );
      await Promise.resolve();
    });
    expect(container.textContent).not.toContain('Private content');
    expect(container.textContent).not.toContain('private authorization detail');
    expect(
      container.querySelector('[data-slot="query-error-alert"]')?.getAttribute('data-presentation'),
    ).toBe('blocking');

    for (const query of [
      createQuery({
        isError: true,
        error: new Exception('private network detail', { code: 'NETWORK_ERROR' }),
      }),
      createQuery({ isPending: true, isFetching: true }),
    ]) {
      await act(async () => {
        renderWithErrorPolicy(
          root,
          <QueryBoundary
            queries={[query]}
            resolutionKey="private-records"
            isInitialResolutionApproved
          >
            <section aria-label="Private records">Private content</section>
          </QueryBoundary>,
        );
        await Promise.resolve();
      });
      expect(container.textContent).not.toContain('Private content');
    }

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryBoundary
          queries={[createQuery()]}
          resolutionKey="private-records"
          isInitialResolutionApproved
        >
          <section aria-label="Private records">Newly authorized content</section>
        </QueryBoundary>,
      );
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Newly authorized content');
  });
  test('real queries keep revoked data hidden through a failed Retry until a successful read', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('Private original')
      .mockRejectedValueOnce(new Exception('Private permissions', { code: 'ACCESS_REVOKED' }))
      .mockRejectedValueOnce(new Exception('Private network', { code: 'NETWORK_ERROR' }))
      .mockResolvedValueOnce('Private updated');
    const PrivateRecords = () => {
      const query = useQuery({ queryKey: ['private-recovery'], queryFn: read, staleTime: 0 });
      return (
        <QueryBoundary
          queries={[query]}
          resolutionKey="private"
          isInitialResolutionApproved
        >
          <p>{query.data}</p>
          <button
            type="button"
            onClick={() => void query.refetch()}
          >
            Read private records
          </button>
        </QueryBoundary>
      );
    };
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryClientProvider client={queryClient}>
          <PrivateRecords />
        </QueryClientProvider>,
      );
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Private original'));
    await act(async () => {
      getByRole(container, 'button', { name: 'Read private records' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(container.textContent).toContain('You do not have permission'));
    expect(container.textContent).not.toContain('Private original');
    await act(async () => {
      getByRole(container, 'button', { name: 'Retry' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(container.textContent).toContain('We could not reach the service'),
    );
    expect(container.textContent).not.toContain('Private original');
    await act(async () => {
      getByRole(container, 'button', { name: 'Retry' }).click();
      await Promise.resolve();
    });
    await vi.waitFor(() => expect(container.textContent).toContain('Private updated'));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(read).toHaveBeenCalledTimes(4);
  });
});
