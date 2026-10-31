import { renderWithErrorPolicy } from '../../shared/error-feedback/error-feedback.test-utils.js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Exception } from 'jg-exception';

import { QueryErrorAlert, type IQueryErrorAlertQuery } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Creates a minimal query-like object for QueryErrorAlert scenarios.
 * @param overrides The query fields to override for a scenario.
 * @returns The query-like object consumed by QueryErrorAlert.
 */
const createQuery = (overrides: Partial<IQueryErrorAlertQuery> = {}): IQueryErrorAlertQuery => ({
  error: null,
  isError: false,
  isFetching: false,
  isRefetching: false,
  refetch: vi.fn<() => Promise<unknown>>().mockResolvedValue({ isError: false }),
  ...overrides,
});

/**
 * Returns the rendered query error alert element.
 * @param container The rendered test container.
 * @returns The query error alert element.
 */
const getQueryErrorAlert = (container: HTMLElement): HTMLElement => {
  const queryErrorAlert = container.querySelector<HTMLElement>('[data-slot="query-error-alert"]');

  if (queryErrorAlert === null) {
    throw new Error('Query error alert was not found.');
  }

  return queryErrorAlert;
};

/**
 * Returns the rendered retry button.
 * @param container The rendered test container.
 * @returns The query error alert retry button.
 */
const getRetryButton = (container: HTMLElement): HTMLButtonElement => {
  const retryButton = container.querySelector<HTMLButtonElement>('button');

  if (retryButton === null) {
    throw new Error('Query error alert retry button was not found.');
  }

  return retryButton;
};

/**
 * Returns the focusable error code tooltip trigger.
 * @param container The rendered test container.
 * @returns The query error alert code tooltip trigger.
 */
const getErrorCodeTrigger = (container: HTMLElement): HTMLElement => {
  const errorCodeTrigger = container.querySelector<HTMLElement>(
    '[data-slot="query-error-alert-code-trigger"]',
  );

  if (errorCodeTrigger === null) {
    throw new Error('Query error alert code trigger was not found.');
  }

  return errorCodeTrigger;
};

describe('QueryErrorAlert', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });

    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('does not render when no query is errored', () => {
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="blocking"
          queries={[createQuery()]}
        />,
      );
    });

    expect(container.querySelector('[data-slot="query-error-alert"]')).toBe(null);
  });

  test('does not report a caller-cancelled read as an outage', () => {
    const error = new Error('private cancellation detail');
    error.name = 'AbortError';
    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="retained"
          queries={[createQuery({ isError: true, error })]}
        />,
      );
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  test('renders reviewed public copy and a bounded error code', () => {
    const failedQuery = createQuery({
      error: new Exception('Admin list unavailable', { code: 'PUBLIC_REQUEST' }),
      isError: true,
    });

    act(() => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="blocking"
          title="Admin list unavailable"
          queries={[failedQuery]}
        />,
      );
    });

    const queryErrorAlert = getQueryErrorAlert(container);
    const errorCode = container.querySelector('[data-slot="query-error-alert-code"]');
    const errorCodeTrigger = getErrorCodeTrigger(container);

    expect(queryErrorAlert.getAttribute('role')).toBe('alert');
    expect(queryErrorAlert.getAttribute('data-presentation')).toBe('blocking');
    expect(queryErrorAlert.textContent).toContain('Admin list unavailable');
    expect(queryErrorAlert.textContent).toContain(
      'We could not complete this request. Please try again.',
    );
    expect(queryErrorAlert.textContent).toContain('Code PUBLIC_REQUEST');
    expect(errorCode?.textContent).toBe('Code PUBLIC_REQUEST');
    expect(errorCodeTrigger.getAttribute('title')).toBe(null);
    expect(errorCodeTrigger.getAttribute('tabindex')).toBe('0');
    expect(getRetryButton(container).getAttribute('aria-label')).toBe('Retry');
    expect(getRetryButton(container).getAttribute('data-size')).toBe('touch');
  });

  test('shows the full error code in a tooltip when the code receives focus', async () => {
    const failedQuery = createQuery({
      error: new Exception('Admin list unavailable', { code: 'PUBLIC_REQUEST' }),
      isError: true,
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="retained"
          title="Admin list unavailable"
          queries={[failedQuery]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      getErrorCodeTrigger(container).focus();
      await Promise.resolve();
    });

    const tooltipContent = document.body.querySelector('[data-slot="tooltip-content"]');

    expect(tooltipContent?.textContent).toContain('PUBLIC_REQUEST');
  });

  test('retries only the failed queries', async () => {
    const failedQueryRefetch = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ isError: false });
    const successfulQueryRefetch = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValue({ isError: false });
    const failedQuery = createQuery({
      error: new Exception('Failed request', { code: 'FAILED_REQUEST' }),
      isError: true,
      refetch: failedQueryRefetch,
    });
    const successfulQuery = createQuery({
      refetch: successfulQueryRefetch,
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="retained"
          queries={[failedQuery, successfulQuery]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      getRetryButton(container).click();
      await Promise.resolve();
    });

    expect(failedQueryRefetch).toHaveBeenCalledTimes(1);
    expect(successfulQueryRefetch).not.toHaveBeenCalled();
    expect(getQueryErrorAlert(container).getAttribute('data-presentation')).toBe('retained');
  });

  test('keeps repeated retry failures visible and actionable', async () => {
    const failedQuery = createQuery({
      error: new Exception('Failed request', { code: 'FAILED_REQUEST' }),
      isError: true,
      refetch: vi.fn<() => Promise<unknown>>().mockResolvedValue({
        error: new Exception('Still failed', { code: 'STILL_FAILED' }),
        isError: true,
      }),
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="blocking"
          queries={[failedQuery]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      getRetryButton(container).click();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(getRetryButton(container).disabled).toBe(false);
    });
    expect(getQueryErrorAlert(container).textContent).toContain(
      'We could not complete this request. Please try again.',
    );
  });

  test('keeps thrown retry failures visible and actionable', async () => {
    const failedQuery = createQuery({
      error: new Exception('Failed request', { code: 'FAILED_REQUEST' }),
      isError: true,
      refetch: vi.fn<() => Promise<unknown>>().mockRejectedValue(new Error('Network failed.')),
    });

    await act(async () => {
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="retained"
          queries={[failedQuery]}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      getRetryButton(container).click();
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(getRetryButton(container).disabled).toBe(false);
    });
    expect(getQueryErrorAlert(container).textContent).toContain(
      'We could not complete this request. Please try again.',
    );
  });
  test('coalesces rapid retries and keeps synchronous refetch failures actionable', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const refetch = vi.fn(() => pending);
    act(() =>
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="blocking"
          queries={[createQuery({ isError: true, refetch })]}
        />,
      ),
    );
    try {
      act(() => {
        getRetryButton(container).click();
        getRetryButton(container).click();
      });
      expect(refetch).toHaveBeenCalledOnce();
    } finally {
      await act(async () => {
        finish();
        await pending;
      });
    }
    const syncFailure = vi.fn<() => Promise<unknown>>(() => {
      throw new Error('Private synchronous read failure');
    });
    act(() =>
      renderWithErrorPolicy(
        root,
        <QueryErrorAlert
          presentation="blocking"
          queries={[createQuery({ isError: true, refetch: syncFailure })]}
        />,
      ),
    );
    await act(async () => {
      getRetryButton(container).click();
      await Promise.resolve();
    });
    expect(syncFailure).toHaveBeenCalledOnce();
    expect(getRetryButton(container).disabled).toBe(false);
    expect(container.textContent).not.toContain('Private synchronous');
  });
});
