import { StrictMode } from 'react';
import { ThemeProvider } from '../theme-provider/index.js';
import { UiPreferencesProvider } from '../ui-preferences-provider/index.js';
import { renderWithErrorPolicy } from '../../shared/error-feedback/error-feedback.test-utils.js';
import { isValidElement, type MouseEvent, type ReactNode } from 'react';
import { act } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Exception } from 'jg-exception';

import { toastr, Toastr, type IExternalToastr } from '../toastr/index.js';
import { QueryErrorToastr, type IQueryErrorAlertQuery } from './index.js';

// mocked shared toastr records lifecycle updates without requiring a mounted portal host.
const toastrMocks = {
  dismiss: vi.fn<typeof toastr.dismiss>(),
  error: vi.fn<typeof toastr.error>().mockReturnValue(0),
};

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

type IRecordedToastrAction = {
  label: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

type IDeferred = {
  promise: Promise<void>;
  resolve: () => void;
};

/** Creates a controllable promise for retry concurrency tests. */
const createDeferred = (): IDeferred => {
  let resolvePromise = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return { promise, resolve: resolvePromise };
};

/** Creates a structural query result for query-error toast scenarios. */
const createQuery = (overrides: Partial<IQueryErrorAlertQuery> = {}): IQueryErrorAlertQuery => ({
  error: null,
  isError: false,
  isFetching: false,
  isRefetching: false,
  refetch: vi.fn<() => Promise<unknown>>().mockResolvedValue({ isError: false }),
  ...overrides,
});

/** Returns the options from the most recent error toast publication. */
const getLatestToastrOptions = (): IExternalToastr => {
  const latestCall = toastrMocks.error.mock.calls.at(-1);
  const options = latestCall?.[1];

  if (options === undefined) {
    throw new Error('Query error toast options were not published.');
  }

  return options;
};

/** Returns the retry action from the most recent error toast publication. */
const getLatestRetryAction = (): IRecordedToastrAction => {
  const action = getLatestToastrOptions().action;

  if (
    action === undefined ||
    action === null ||
    isValidElement(action) ||
    typeof action !== 'object' ||
    !('onClick' in action) ||
    typeof action.onClick !== 'function'
  ) {
    throw new Error('Query error toast retry action was not published.');
  }

  return action;
};

/** Invokes a recorded toast action through its React click contract. */
const invokeRetryAction = (action: IRecordedToastrAction): boolean => {
  let isDefaultPrevented = false;

  action.onClick({
    preventDefault: () => {
      isDefaultPrevented = true;
    },
  } as MouseEvent<HTMLButtonElement>);

  return isDefaultPrevented;
};

describe('QueryErrorToastr', () => {
  let container: HTMLDivElement;
  let isRootUnmounted: boolean;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.spyOn(toastr, 'error').mockImplementation(toastrMocks.error);
    vi.spyOn(toastr, 'dismiss').mockImplementation(toastrMocks.dismiss);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    isRootUnmounted = false;
  });

  afterEach(async () => {
    if (!isRootUnmounted) {
      await act(async () => {
        root.unmount();
        await Promise.resolve();
      });
    }

    container.remove();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  test('publishes normalized safe details through a persistent layout-free toast', async () => {
    const failedQuery = createQuery({
      error: new Exception('Current account data could not be refreshed.', {
        code: 'ME_REFRESH_FAILED',
      }),
      isError: true,
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          title="Account refresh failed"
          queries={[failedQuery]}
        />,
      );

      await Promise.resolve();
    });

    expect(container.childElementCount).toBe(0);
    expect(toastrMocks.error).toHaveBeenCalledOnce();
    expect(toastrMocks.error.mock.calls[0]?.[0]).toBe('Account refresh failed');
    const { action, ...options } = getLatestToastrOptions();
    expect(action).toBe(getLatestRetryAction());
    expect(getLatestRetryAction().label).toBe('Retry');
    expect(options).toStrictEqual({
      description: 'We could not complete this request. Please try again.',
      dismissible: false,
      duration: Number.POSITIVE_INFINITY,
      id: 'account-refresh-error',
    });
  });

  test('keeps the existing toast when only private diagnostic detail changes', async () => {
    for (const message of ['private first failure', 'private next failure']) {
      await act(async () => {
        renderWithErrorPolicy(
          root,
          <QueryErrorToastr
            toastId="stable-outage"
            queries={[
              createQuery({
                error: new Exception(message, { code: 'NETWORK_ERROR' }),
                isError: true,
              }),
            ]}
          />,
        );

        await Promise.resolve();
      });
    }
    expect(toastrMocks.error).toHaveBeenCalledTimes(1);
    expect(getLatestToastrOptions().description).not.toContain('private');
  });

  test('updates repeated failures under the same caller-supplied toast identity', async () => {
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[
            createQuery({
              error: new Exception('private first failure', { code: 'TIMEOUT' }),
              isError: true,
            }),
          ]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[
            createQuery({
              error: new Exception('private next failure', { code: 'NETWORK_ERROR' }),
              isError: true,
            }),
          ]}
        />,
      );

      await Promise.resolve();
    });

    expect(toastrMocks.error).toHaveBeenCalledTimes(2);
    expect(toastrMocks.error.mock.calls.map((call) => call[1]?.id)).toStrictEqual([
      'account-refresh-error',
      'account-refresh-error',
    ]);
    expect(getLatestToastrOptions().description).toBe(
      'We could not reach the service. Please try again in a moment. Code NETWORK_ERROR',
    );
    expect(toastrMocks.dismiss).not.toHaveBeenCalled();
  });

  test('retries only the currently failed queries', async () => {
    const firstFailedRefetch = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ isError: false });
    const secondFailedRefetch = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ isError: false });
    const healthyRefetch = vi.fn<() => Promise<unknown>>().mockResolvedValue({ isError: false });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[
            createQuery({ isError: true, refetch: firstFailedRefetch }),
            createQuery({ refetch: healthyRefetch }),
            createQuery({ isError: true, refetch: secondFailedRefetch }),
          ]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      expect(invokeRetryAction(getLatestRetryAction())).toBe(true);
      await Promise.resolve();
    });

    expect(firstFailedRefetch).toHaveBeenCalledOnce();
    expect(secondFailedRefetch).toHaveBeenCalledOnce();
    expect(healthyRefetch).not.toHaveBeenCalled();
  });

  test('blocks repeated retry actions while its retry is unsettled', async () => {
    const deferredRetry = createDeferred();
    const refetch = vi.fn<() => Promise<void>>().mockReturnValue(deferredRetry.promise);

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[createQuery({ isError: true, refetch })]}
        />,
      );

      await Promise.resolve();
    });

    const retryAction = getLatestRetryAction();

    await act(async () => {
      invokeRetryAction(retryAction);
      invokeRetryAction(retryAction);

      await Promise.resolve();
    });

    expect(refetch).toHaveBeenCalledOnce();
    expect(getLatestRetryAction().label).toBe('Retrying');

    await act(async () => {
      deferredRetry.resolve();
      await deferredRetry.promise;
    });

    expect(getLatestRetryAction().label).toBe('Retry');
  });

  test('does not start another retry while a failed query reports active fetching', async () => {
    const refetch = vi.fn<() => Promise<unknown>>().mockResolvedValue({ isError: false });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[createQuery({ isError: true, isFetching: true, refetch })]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      invokeRetryAction(getLatestRetryAction());

      await Promise.resolve();
    });

    expect(getLatestRetryAction().label).toBe('Retrying');
    expect(refetch).not.toHaveBeenCalled();
  });

  test('dismisses its toast when every query recovers', async () => {
    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[createQuery({ isError: true })]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[createQuery()]}
        />,
      );

      await Promise.resolve();
    });

    expect(toastrMocks.dismiss).toHaveBeenCalledExactlyOnceWith('account-refresh-error');
  });

  test('dismisses its toast when the owner unmounts', async () => {
    const refetch = vi.fn<() => Promise<unknown>>().mockResolvedValue({ isError: false });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorToastr
          toastId="account-refresh-error"
          queries={[createQuery({ isError: true, refetch })]}
        />,
      );

      await Promise.resolve();
    });
    const retryAction = getLatestRetryAction();

    await act(async () => {
      root.unmount();
      await Promise.resolve();
    });
    isRootUnmounted = true;

    expect(toastrMocks.dismiss).toHaveBeenCalledExactlyOnceWith('account-refresh-error');

    await act(async () => {
      invokeRetryAction(retryAction);

      await Promise.resolve();
    });

    expect(refetch).not.toHaveBeenCalled();
  });
});

test.each([
  [false, false],
  [true, false],
  [false, true],
])(
  'a later-mounted real host retains one actionable failure with StrictMode %s and hydration %s',
  async (isStrict, shouldHydrate) => {
    // Sonner dismisses through animation frames and a removal timer; background tabs throttle both.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
    });
    const container = document.createElement('div');
    document.body.append(container);
    let root: Root | undefined;
    const retry = vi.fn<() => Promise<unknown>>().mockResolvedValue(undefined);
    const first = createQuery({ isError: true, error: new Error('PRIVATE FIRST'), refetch: retry });
    const replacement = createQuery({ ...first, error: new Error('PRIVATE REPLACEMENT') });
    const render = (key: string, query: IQueryErrorAlertQuery) => {
      const content = (
        <UiPreferencesProvider mode="read-only">
          <ThemeProvider disableTransitionOnChange={false}>
            <QueryErrorToastr
              key={key}
              toastId="real-host-replacement"
              title={key === 'first' ? 'Records unavailable' : 'Replacement records unavailable'}
              fallbackMessage="Records could not be updated."
              queries={[query]}
            />
            <Toastr />
          </ThemeProvider>
        </UiPreferencesProvider>
      );
      const element = isStrict ? <StrictMode>{content}</StrictMode> : content;
      if (root === undefined) {
        if (shouldHydrate) {
          container.innerHTML = renderToString(element);
          root = hydrateRoot(container, element);
        } else {
          root = createRoot(container);
          root.render(element);
        }
      } else root.render(element);
    };
    try {
      await act(async () => {
        render('first', first);
        await Promise.resolve();
      });
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1),
      );
      await act(async () => {
        render('replacement', replacement);
        await Promise.resolve();
      });
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1),
      );
      await vi.waitFor(() =>
        expect(document.querySelector('[data-sonner-toast]')?.textContent).toContain(
          'Replacement records unavailable',
        ),
      );
      const toast = document.querySelector<HTMLElement>('[data-sonner-toast]');
      expect(toast?.textContent).toContain('Records could not be updated.');
      expect(toast?.textContent).not.toContain('PRIVATE');
      const action = toast?.querySelector<HTMLButtonElement>('button[data-action]');
      expect(action?.textContent).toBe('Retry');
      await act(async () => {
        action?.click();
        await Promise.resolve();
      });
      expect(retry).toHaveBeenCalledOnce();
      expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1);
      await act(async () => {
        render('replacement', createQuery());
        await Promise.resolve();
      });
      await vi.waitFor(() =>
        expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(0),
      );
    } finally {
      await act(async () => {
        root?.unmount();
        await Promise.resolve();
      });
      toastr.dismiss('real-host-replacement');
      container.remove();
      vi.useRealTimers();
    }
  },
);
