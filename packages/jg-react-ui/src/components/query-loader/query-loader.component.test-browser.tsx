import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { QueryLoader, type IQueryLoaderQuery } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Creates a minimal query-like object for QueryLoader scenarios.
 * @param overrides The query loading fields to override for a scenario.
 * @returns The query-like object consumed by QueryLoader.
 */
const createQuery = (overrides: Partial<IQueryLoaderQuery> = {}): IQueryLoaderQuery => ({
  isError: false,
  isLoading: false,
  isPending: false,
  ...overrides,
});

/**
 * Returns the rendered query loader element.
 * @param container The rendered test container.
 * @returns The query loader element.
 */
const getQueryLoader = (container: HTMLElement): HTMLElement => {
  const queryLoader = container.querySelector<HTMLElement>('[data-slot="query-loader"]');

  if (queryLoader === null) {
    throw new Error('Query loader was not found.');
  }

  return queryLoader;
};

/**
 * Returns the rendered spinner element inside the query loader.
 * @param container The rendered test container.
 * @returns The spinner element.
 */
const getSpinner = (container: HTMLElement): SVGElement => {
  const spinner = container.querySelector<SVGElement>('[data-slot="spinner"]');

  if (spinner === null) {
    throw new Error('Query loader spinner was not found.');
  }

  return spinner;
};

describe('QueryLoader', () => {
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
  });

  test('does not render when no query is loading', () => {
    act(() => {
      root.render(<QueryLoader queries={[createQuery()]} />);
    });

    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
  });

  test('renders while any query is pending', () => {
    act(() => {
      root.render(
        <QueryLoader
          queries={[createQuery(), createQuery({ isPending: true })]}
          aria-label="Loading page data"
        />,
      );
    });

    const queryLoader = getQueryLoader(container);
    const spinner = getSpinner(container);

    expect(queryLoader.getAttribute('role')).toBe('status');
    expect(queryLoader.getAttribute('aria-label')).toBe('Loading page data');
    expect(queryLoader.dataset['layout']).toBe('inline');
    expect(spinner.getAttribute('aria-hidden')).toBe('true');
    expect(spinner.getAttribute('role')).toBe(null);
  });

  test('honors an explicit visibility state from a coordinating boundary', () => {
    act(() => {
      root.render(
        <QueryLoader
          isVisible
          queries={[createQuery()]}
        />,
      );
    });

    expect(container.querySelector('[data-slot="query-loader"]')).not.toBe(null);

    act(() => {
      root.render(
        <QueryLoader
          isVisible={false}
          queries={[createQuery({ isLoading: true })]}
        />,
      );
    });

    expect(container.querySelector('[data-slot="query-loader"]')).toBe(null);
  });

  test('applies the requested size and class names', { tags: ['full'] }, () => {
    act(() => {
      root.render(
        <QueryLoader
          className="mt-3"
          classNames={{
            root: 'min-h-40',
            spinner: 'text-primary',
          }}
          queries={[createQuery({ isLoading: true })]}
          size="xl"
        />,
      );
    });

    const queryLoader = getQueryLoader(container);
    const spinner = getSpinner(container);

    expect(queryLoader.className).toContain('mt-3');
    expect(queryLoader.className).toContain('min-h-40');
    expect(spinner.getAttribute('class')).toContain('size-12');
    expect(spinner.getAttribute('class')).toContain('text-primary');
  });

  test.each([
    ['inline', 'mt-10'],
    ['dialog', 'h-[clamp(8rem,32svh,16rem)]'],
    ['page', 'fixed'],
  ] as const)(
    'applies the %s centering layout',
    { tags: ['full'] },
    (layout, expectedClassName) => {
      act(() => {
        root.render(
          <QueryLoader
            layout={layout}
            queries={[createQuery({ isLoading: true })]}
          />,
        );
      });

      const queryLoader = getQueryLoader(container);

      expect(queryLoader.dataset['layout']).toBe(layout);
      expect(queryLoader.className).toContain(expectedClassName);
    },
  );
});
