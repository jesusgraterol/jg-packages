import type * as ServiceWorker from 'jg-sw';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Exception } from 'jg-exception';

import { GlobalErrorBoundaryView } from './index.js';

// mocked service worker update prevents the test from reloading the document.
const serviceWorkerMock = vi.hoisted(() => ({
  updateApp: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock('jg-sw', async (importOriginal) => ({
  ...(await importOriginal<typeof ServiceWorker>()),
  updateApp: serviceWorkerMock.updateApp,
}));

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Returns the rendered global error boundary root element.
 * @param container The rendered test container.
 * @returns The global error boundary root element.
 */
const getGlobalErrorBoundary = (container: HTMLElement): HTMLElement => {
  const boundary = container.querySelector<HTMLElement>('[data-slot="global-error-boundary"]');

  if (boundary === null) {
    throw new Error('Global error boundary was not found.');
  }

  return boundary;
};

/**
 * Returns the rendered refresh button.
 * @param container The rendered test container.
 * @returns The global error boundary refresh button.
 */
const getRefreshButton = (container: HTMLElement): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>(
    '[data-slot="global-error-boundary-refresh-button"]',
  );

  if (button === null) {
    throw new Error('Global error boundary refresh button was not found.');
  }

  return button;
};

describe('GlobalErrorBoundary', () => {
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
    vi.clearAllMocks();
  });

  test('renders route errors with safe copy and responsive theme-aware recovery styling', () => {
    act(() => {
      root.render(<GlobalErrorBoundaryView error={new Error('Private route detail')} />);
    });

    const boundary = getGlobalErrorBoundary(container);
    const heading = container.querySelector('[data-slot="global-error-boundary-heading"]');
    const content = container.querySelector('[data-slot="global-error-boundary-content"]');
    const errorMessage = container.querySelector(
      '[data-slot="global-error-boundary-error-message"]',
    );
    const errorCode = container.querySelector('[data-slot="global-error-boundary-error-code"]');
    const refreshButton = getRefreshButton(container);

    expect(boundary.className).toContain('min-h-svh');
    expect(boundary.className).toContain('bg-primary');
    expect(boundary.className).toContain('inverse-surface-selection');
    expect(boundary.className).not.toContain('isolate');
    expect(boundary.querySelector('.blur-3xl')).toBe(null);
    expect(boundary.className).toContain('px-page-gutter');
    expect(boundary.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(content?.getAttribute('role')).toBe('alert');
    expect(heading?.className).toContain('sm:text-6xl');
    expect(heading?.textContent).toBe('Something went wrong');
    expect(errorMessage?.textContent).toBe('Something went wrong. Please try again.');
    expect(errorCode?.textContent).toBe('Error code: Unknown');
    expect(refreshButton.type).toBe('button');
    expect(refreshButton.className).toContain('focus-visible:ring-primary-foreground');
    expect(refreshButton.className).toContain('dark:enabled:hover:bg-primary-foreground/85');
    expect(refreshButton.textContent).toContain('Refresh app');
  });

  test('refreshes the app through jg-sw updateApp by default', async () => {
    await act(async () => {
      root.render(<GlobalErrorBoundaryView error={new Error('Private route detail')} />);

      await Promise.resolve();
    });

    await act(async () => {
      getRefreshButton(container).click();
      await Promise.resolve();
    });

    expect(serviceWorkerMock.updateApp).toHaveBeenCalledTimes(1);
  });

  test('supports custom copy, classes, and injected refresh behavior', async () => {
    const handleRefreshClick = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <GlobalErrorBoundaryView
          className="min-h-96"
          classNames={{
            content: 'max-w-xl',
            errorCode: 'tracking-wide',
            errorMessage: 'font-mono',
            heading: 'text-3xl',
            refreshButton: 'sm:w-auto',
            root: 'rounded-lg',
            status: 'uppercase',
          }}
          description="Refresh the admin app to recover."
          error={{ message: 'Serialized route failure.' }}
          heading="Admin app unavailable"
          refreshButtonLabel="Reload admin"
          statusLabel="Route error"
          onRefreshClick={handleRefreshClick}
        />,
      );

      await Promise.resolve();
    });

    const boundary = getGlobalErrorBoundary(container);
    const content = container.querySelector('[data-slot="global-error-boundary-content"]');
    const status = container.querySelector('[data-slot="global-error-boundary-status"]');
    const heading = container.querySelector('[data-slot="global-error-boundary-heading"]');
    const description = container.querySelector('[data-slot="global-error-boundary-description"]');
    const errorMessage = container.querySelector(
      '[data-slot="global-error-boundary-error-message"]',
    );
    const errorCode = container.querySelector('[data-slot="global-error-boundary-error-code"]');
    const refreshButton = getRefreshButton(container);

    expect(boundary.className).toContain('min-h-96');
    expect(boundary.className).toContain('rounded-lg');
    expect(content?.className).toContain('max-w-xl');
    expect(status?.className).toContain('uppercase');
    expect(status?.textContent).toContain('Route error');
    expect(heading?.className).toContain('text-3xl');
    expect(heading?.textContent).toBe('Admin app unavailable');
    expect(description?.textContent).toBe('Refresh the admin app to recover.');
    expect(errorMessage?.className).toContain('font-mono');
    expect(errorMessage?.textContent).toBe('Something went wrong. Please try again.');
    expect(errorCode?.className).toContain('tracking-wide');
    expect(errorCode?.textContent).toBe('Error code: Unknown');
    expect(refreshButton.className).toContain('sm:w-auto');
    expect(refreshButton.textContent).toContain('Reload admin');

    await act(async () => {
      refreshButton.click();
      await Promise.resolve();
    });

    expect(handleRefreshClick).toHaveBeenCalledTimes(1);
    expect(serviceWorkerMock.updateApp).not.toHaveBeenCalled();
  });

  test('keeps long diagnostic text shrinkable for narrow mobile viewports', () => {
    const longCode = `ROUTE_${'A'.repeat(96)}_FAILED`;

    act(() => {
      root.render(
        <GlobalErrorBoundaryView
          error={{
            code: longCode,
            message: `A route failed with an unbroken diagnostic token ${longCode}.`,
          }}
          statusLabel={`Status ${longCode}`}
        />,
      );
    });

    const content = container.querySelector('[data-slot="global-error-boundary-content"]');
    const status = container.querySelector('[data-slot="global-error-boundary-status"]');
    const errorMessage = container.querySelector(
      '[data-slot="global-error-boundary-error-message"]',
    );
    const errorCode = container.querySelector('[data-slot="global-error-boundary-error-code"]');
    const errorCodeValue = container.querySelector(
      '[data-slot="global-error-boundary-error-code-value"]',
    );

    expect(content?.className).toContain('min-w-0');
    expect(status?.className).toContain('min-w-0');
    expect(errorMessage?.className).toContain('min-w-0');
    expect(errorMessage?.className).toContain('break-words');
    expect(errorCode?.className).toContain('min-w-0');
    expect(errorCodeValue?.className).toContain('break-all');
    expect(errorCodeValue?.textContent).toBe('Unknown');
    expect(errorMessage?.textContent).not.toContain(longCode);
  });

  test('shows refresh failures without diagnostic output', async () => {
    const handleRefreshClick = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(
        new Exception('Service worker refresh failed.', { code: 'SW_REFRESH_FAILED' }),
      );

    await act(async () => {
      root.render(
        <GlobalErrorBoundaryView
          error="Route failed"
          onRefreshClick={handleRefreshClick}
        />,
      );

      await Promise.resolve();
    });

    await act(async () => {
      getRefreshButton(container).click();
      await Promise.resolve();
    });

    const refreshError = container.querySelector(
      '[data-slot="global-error-boundary-refresh-error"]',
    );

    expect(refreshError?.textContent).toBe(
      'Refresh failed: We could not refresh the app. Please try again.',
    );
  });
  test('coalesces refresh clicks before the pending render commits', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const refresh = vi.fn(() => pending);
    act(() =>
      root.render(
        <GlobalErrorBoundaryView
          error={null}
          onRefreshClick={refresh}
        />,
      ),
    );
    try {
      act(() => {
        getRefreshButton(container).click();
        getRefreshButton(container).click();
      });
      expect(refresh).toHaveBeenCalledOnce();
      expect(getRefreshButton(container).disabled).toBe(true);
    } finally {
      await act(async () => {
        finish();
        await pending;
      });
    }
    expect(getRefreshButton(container).disabled).toBe(false);
  });
});
