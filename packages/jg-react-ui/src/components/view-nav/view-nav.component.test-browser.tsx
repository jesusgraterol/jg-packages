import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ViewNav } from './view-nav.component.js';
import { revealInRow } from './utilities.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

const ITEMS = [
  { value: 'events', label: 'Events', to: '?view=events' },
  { value: 'files', label: 'Files', to: '?view=files' },
  { value: 'settings', label: 'Settings', to: '?view=settings' },
] as const;

describe('ViewNav', () => {
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
    vi.restoreAllMocks();
  });

  /**
   * Renders the row in a router, on a page that keeps its way back in the router state.
   * @param current The selected view.
   * @returns The router.
   */
  const renderRow = (current: 'events' | 'files' | 'settings') => {
    const router = createMemoryRouter(
      [
        {
          path: '/sessions/1',
          element: (
            <ViewNav
              preventScrollReset
              replace
              className="mb-2"
              current={current}
              items={ITEMS}
              label="Session views"
              state={{ pageReturn: { href: '/sessions' } }}
            />
          ),
        },
      ],
      { initialEntries: ['/start', '/sessions/1'], initialIndex: 1 },
    );
    act(() => {
      root.render(<RouterProvider router={router} />);
    });
    return router;
  };

  test('marks the selected view as the current page with filled link buttons, never tabs', () => {
    renderRow('files');

    const row = container.querySelector('nav') as HTMLElement;
    expect(row.getAttribute('aria-label')).toBe('Session views');
    expect(row.className).toContain('overflow-x-auto');
    expect(row.className).toContain('mb-2');
    expect(container.querySelector('[role="tab"]')).toBeNull();
    const links = [...row.querySelectorAll('a')];
    expect(links.map((link) => link.textContent)).toStrictEqual(['Events', 'Files', 'Settings']);
    expect(links.map((link) => link.getAttribute('aria-current'))).toStrictEqual([
      null,
      'page',
      null,
    ]);
    expect(links[1]?.className).toContain('bg-secondary');
  });

  test('pushes a history entry by default, and marks nothing while no view is selected', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/sessions/1',
          element: (
            <ViewNav
              current={'archive' as 'events'}
              items={ITEMS}
              label="Session views"
            />
          ),
        },
      ],
      { initialEntries: ['/sessions/1'] },
    );
    act(() => {
      root.render(<RouterProvider router={router} />);
    });
    expect(container.querySelector('[aria-current]')).toBeNull();

    await act(async () => {
      (container.querySelector('a') as HTMLAnchorElement).click();
      await Promise.resolve();
    });

    expect(router.state.historyAction).toBe('PUSH');
    expect(router.state.location.search).toBe('?view=events');
  });

  test('replaces the history entry and keeps the router state as it switches views', async () => {
    const router = renderRow('events');
    const settings = container.querySelectorAll('a')[2] as HTMLAnchorElement;

    await act(async () => {
      settings.click();
      await Promise.resolve();
    });

    expect(router.state.historyAction).toBe('REPLACE');
    expect(router.state.location.search).toBe('?view=settings');
    expect(router.state.location.state).toStrictEqual({ pageReturn: { href: '/sessions' } });
  });

  test('scrolls the row to show the selected link, and a link the keyboard focuses', () => {
    const scrollLeft = vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'set');
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.tagName === 'NAV') return new DOMRect(0, 0, 120, 44);
      const index = ITEMS.findIndex((item) => item.label === this.textContent);
      return new DOMRect(index * 90 - 40, 0, 90, 44);
    });

    renderRow('settings');
    // the selected link runs past the row's end, so the row scrolls right
    expect(scrollLeft).toHaveBeenLastCalledWith(110);

    const events = container.querySelectorAll('a')[0] as HTMLAnchorElement;
    act(() => {
      events.focus();
    });
    // the focused link starts before the row, so the row scrolls left
    expect(scrollLeft).toHaveBeenLastCalledWith(-40);
  });
});

test('revealInRow(without a row or a link) -> scrolls nothing', () => {
  const link = document.createElement('a');
  const getBox = vi.spyOn(link, 'getBoundingClientRect');

  revealInRow(null, link);
  revealInRow(document.createElement('nav'), null);

  expect(getBox).not.toHaveBeenCalled();
});

test.each([
  ['a link inside the row', new DOMRect(20, 0, 60, 44), 0],
  ['a link past its end', new DOMRect(100, 0, 60, 44), 40],
  ['a link before its start', new DOMRect(-30, 0, 60, 44), -30],
])('revealInRow(%s) -> scrolls by %d', (_case, linkBox, scrolled) => {
  const row = document.createElement('nav');
  const link = document.createElement('a');
  vi.spyOn(row, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 120, 44));
  vi.spyOn(link, 'getBoundingClientRect').mockReturnValue(linkBox);
  let left = 0;
  Object.defineProperty(row, 'scrollLeft', {
    get: () => left,
    set: (value: number) => {
      left = value;
    },
  });

  revealInRow(row, link);

  expect(left).toBe(scrolled);
});
