import type { MouseEventHandler } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { LoadMoreButton, type ILoadMoreButtonQuery } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Returns the rendered load-more button.
 * @param container The rendered test container.
 * @returns The load-more button element.
 */
const getLoadMoreButton = (container: HTMLElement): HTMLButtonElement => {
  const button = container.querySelector<HTMLButtonElement>('[data-slot="load-more-button"]');

  if (button === null) {
    throw new Error('Load-more button was not found.');
  }

  return button;
};

/**
 * Creates a query-like object for LoadMoreButton scenarios.
 * @param overrides The query pagination fields to override for a scenario.
 * @returns The query-like object consumed by LoadMoreButton.
 */
const createLoadMoreQuery = (
  overrides: Partial<ILoadMoreButtonQuery> = {},
): ILoadMoreButtonQuery => ({
  fetchNextPage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  hasNextPage: true,
  isError: false,
  isFetchingNextPage: false,
  ...overrides,
});

describe('LoadMoreButton', () => {
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

  test('renders the default load-more action and fetches the next query page', () => {
    const handleLoadMore = vi.fn<MouseEventHandler<HTMLButtonElement>>();
    const query = createLoadMoreQuery();

    act(() => {
      root.render(
        <LoadMoreButton
          query={query}
          onClick={handleLoadMore}
        />,
      );
    });

    const button = getLoadMoreButton(container);
    const icon = container.querySelector('[data-slot="load-more-button-icon"]');

    expect(button.type).toBe('button');
    expect(button.dataset['loading']).toBe('false');
    expect(container.querySelector('[data-slot="load-more-button-root"]')).toBeInstanceOf(
      HTMLDivElement,
    );
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Load more');
    expect(icon?.getAttribute('data-icon')).toBe('inline-start');

    act(() => {
      button.click();
    });

    expect(handleLoadMore).toHaveBeenCalledTimes(1);
    expect(query.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('renders loading feedback and disables clicks by default', () => {
    const handleLoadMore = vi.fn<MouseEventHandler<HTMLButtonElement>>();
    const query = createLoadMoreQuery({ isFetchingNextPage: true });

    act(() => {
      root.render(
        <LoadMoreButton
          aria-label="Load more records"
          loadingAriaLabel="Loading more records"
          query={query}
          onClick={handleLoadMore}
        />,
      );
    });

    const button = getLoadMoreButton(container);
    const spinner = container.querySelector('[data-slot="spinner"]');

    expect(button.dataset['loading']).toBe('true');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Loading more records');
    expect(button.textContent).toContain('Loading more');
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');

    act(() => {
      button.click();
    });

    expect(handleLoadMore).not.toHaveBeenCalled();
    expect(query.fetchNextPage).not.toHaveBeenCalled();
  });

  test('supports custom labels, icons, placement, classes, and loading click behavior', () => {
    const handleLoadMore = vi.fn<MouseEventHandler<HTMLButtonElement>>();
    const query = createLoadMoreQuery({ isFetchingNextPage: true });

    act(() => {
      root.render(
        <LoadMoreButton
          aria-label="Show older records"
          className="w-auto"
          classNames={{
            button: 'max-w-64',
            icon: 'text-primary',
            label: 'font-semibold',
          }}
          icon={<span data-custom-icon="idle" />}
          iconPlacement="end"
          label="Show older"
          loadingIcon={<span data-custom-icon="loading" />}
          loadingLabel="Fetching records"
          query={query}
          shouldDisableWhenLoading={false}
          variant="secondary"
          onClick={handleLoadMore}
        />,
      );
    });

    const button = getLoadMoreButton(container);
    const rootElement = container.querySelector('[data-slot="load-more-button-root"]');
    const icon = container.querySelector('[data-slot="load-more-button-icon"]');
    const label = container.querySelector('[data-slot="load-more-button-label"]');

    expect(button.disabled).toBe(false);
    expect(rootElement?.className).toContain('w-auto');
    expect(button.className).toContain('max-w-64');
    expect(button.textContent).toContain('Fetching records');
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(icon?.getAttribute('data-icon')).toBe('inline-end');
    expect(icon?.className).toContain('text-primary');
    expect(label?.className).toContain('font-semibold');
    expect(container.querySelector('[data-custom-icon="loading"]')).toBeInstanceOf(HTMLSpanElement);

    act(() => {
      button.click();
    });

    expect(handleLoadMore).toHaveBeenCalledTimes(1);
    expect(query.fetchNextPage).not.toHaveBeenCalled();
  });

  test('does not render when the query cannot load another page', () => {
    act(() => {
      root.render(<LoadMoreButton query={createLoadMoreQuery({ hasNextPage: false })} />);
    });

    expect(container.querySelector('[data-slot="load-more-button-root"]')).toBe(null);
  });

  test.each([false, true])(
    'uses visible pagination text as its accessible name when loading is %s',
    (isFetchingNextPage) => {
      act(() => {
        root.render(
          <LoadMoreButton
            query={createLoadMoreQuery({ isFetchingNextPage })}
            label={<span>Load more promo codes</span>}
            loadingLabel={<span>Loading more promo codes</span>}
          />,
        );
      });
      const button = getLoadMoreButton(container);
      expect(button.getAttribute('aria-label')).toBeNull();
      expect(button.textContent).toBe(
        isFetchingNextPage ? 'Loading more promo codes' : 'Load more promo codes',
      );
    },
  );
});
