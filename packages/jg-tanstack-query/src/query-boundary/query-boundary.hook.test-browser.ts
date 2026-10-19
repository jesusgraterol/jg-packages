import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getErrorCode } from 'jg-exception';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { useQueryBoundary } from './query-boundary.hook.js';

type IHarnessProps = {
  queryKey: string[];
  read: () => Promise<string>;
  isInitialResolutionApproved?: boolean;
  checksAccess?: boolean;
};

// tells React the tests wrap their updates in act, so it warns about none
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Reads whether an error means the user lost access.
 * @param error The error.
 * @returns Whether its code is ACCESS_DENIED.
 */
const isAccessDenied = (error: unknown): boolean => getErrorCode(error) === 'ACCESS_DENIED';

/**
 * Renders a stale-at-once query through the boundary: a loader, an alert with Retry, and the
 * content with a Refresh button.
 * @param props The query's key and read, and whether the app approved its data.
 * @returns The boundary's markup.
 */
const BoundaryHarness = ({
  queryKey,
  read,
  isInitialResolutionApproved,
  checksAccess = true,
}: IHarnessProps): ReactElement => {
  const query = useQuery({ queryKey, queryFn: read, staleTime: 0 });
  const boundary = useQueryBoundary({
    queries: [query],
    resolutionKey: queryKey.join(':'),
    isInitialResolutionApproved,
    isAccessDenied: checksAccess ? isAccessDenied : undefined,
  });
  return createElement(
    'div',
    null,
    boundary.isLoaderVisible ? createElement('p', null, 'Loading') : null,
    boundary.hasError
      ? createElement(
          'div',
          { role: 'alert', 'data-presentation': boundary.errorPresentation },
          isAccessDenied(query.error)
            ? 'You no longer have access.'
            : 'The service is unreachable.',
          createElement('button', { type: 'button', onClick: boundary.retryFailed }, 'Retry'),
        )
      : null,
    boundary.canRenderContent
      ? createElement(
          'section',
          null,
          createElement('p', null, query.data),
          createElement(
            'button',
            { type: 'button', onClick: () => void query.refetch() },
            'Refresh',
          ),
        )
      : null,
  );
};

/**
 * Creates a promise the test settles.
 * @returns The promise and its resolve function.
 */
const createDeferred = <T>(): { promise: Promise<T>; resolve: (value: T) => void } => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe('useQueryBoundary', () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  });

  /**
   * Renders the harness inside the test's client.
   * @param props The harness's props.
   */
  const renderHarness = async (props: IHarnessProps): Promise<void> => {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(BoundaryHarness, props),
        ),
      );
      await Promise.resolve();
    });
  };

  /**
   * Waits until the page shows a text, letting React commit what the queries settled.
   * @param text The text.
   */
  const waitForText = async (text: string): Promise<void> => {
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 0);
        });
      });
      expect(container.textContent).toContain(text);
    });
  };

  /**
   * Clicks the button with a label.
   * @param label The label.
   */
  const click = async (label: string): Promise<void> => {
    const button = [...container.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === label,
    );
    if (button === undefined) {
      throw new Error(`The page has no ${label} button.`);
    }
    await act(async () => {
      button.click();
      await Promise.resolve();
    });
  };

  test('hides stale cached data until the refetch after mount, then keeps later refetches on screen', async () => {
    const queryKey = ['records'];
    const initialFetch = createDeferred<string>();
    const laterFetch = createDeferred<string>();
    const read = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(() => initialFetch.promise)
      .mockImplementationOnce(() => laterFetch.promise);
    queryClient.setQueryData(queryKey, 'Stale records');

    await renderHarness({ queryKey, read });

    expect(read).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Loading');
    expect(container.textContent).not.toContain('Stale records');

    await act(async () => {
      initialFetch.resolve('Current records');
      await initialFetch.promise;
    });
    await waitForText('Current records');
    expect(container.textContent).not.toContain('Loading');

    await click('Refresh');
    expect(read).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain('Loading');
    expect(container.textContent).toContain('Current records');

    await act(async () => {
      laterFetch.resolve('Updated records');
      await laterFetch.promise;
    });
    await waitForText('Updated records');
  });

  test('keeps revoked content hidden through a failed retry, and shows it again after a successful read', async () => {
    const queryKey = ['private-records'];
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('Private original')
      .mockRejectedValueOnce(Object.assign(new Error('Forbidden.'), { code: 'ACCESS_DENIED' }))
      .mockRejectedValueOnce(Object.assign(new Error('Offline.'), { code: 'NETWORK_FAILED' }))
      .mockResolvedValueOnce('Private updated');

    await renderHarness({ queryKey, read, isInitialResolutionApproved: true });
    await waitForText('Private original');

    await click('Refresh');
    await waitForText('You no longer have access.');
    expect(container.textContent).not.toContain('Private original');
    expect(container.querySelector('[role="alert"]')?.getAttribute('data-presentation')).toBe(
      'blocking',
    );

    await click('Retry');
    await waitForText('The service is unreachable.');
    expect(container.textContent).not.toContain('Private original');

    await click('Retry');
    await waitForText('Private updated');
    expect(container.textContent).not.toContain('Private original');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(read).toHaveBeenCalledTimes(4);
  });

  test('keeps the content beside any error without an access check', async () => {
    const queryKey = ['unchecked-records'];
    const read = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce('Records')
      .mockRejectedValueOnce(Object.assign(new Error('Forbidden.'), { code: 'ACCESS_DENIED' }));

    await renderHarness({ queryKey, read, checksAccess: false });
    await waitForText('Records');

    await click('Refresh');
    await waitForText('You no longer have access.');
    expect(container.textContent).toContain('Records');
    expect(container.querySelector('[role="alert"]')?.getAttribute('data-presentation')).toBe(
      'retained',
    );
  });
});
