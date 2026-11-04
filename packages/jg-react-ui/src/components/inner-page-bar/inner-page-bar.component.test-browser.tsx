import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createPageReturn } from 'jg-react-router';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { InnerPageBar } from './inner-page-bar.component.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// the app's way back: only the plans list, by its own name
const PAGE_RETURN = createPageReturn({
  resolveOrigin: (url) => (url.pathname === '/plans' ? { href: '/plans', label: 'Plans' } : null),
});

describe('InnerPageBar', () => {
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

  /**
   * Renders the bar on a session's page, reached with the given router state.
   * @param state The router state the page was reached with.
   * @param actions The page's actions.
   */
  const renderBar = (state: unknown, actions?: React.ReactNode): void => {
    const router = createMemoryRouter(
      [
        {
          path: '/sessions/1',
          element: (
            <InnerPageBar
              actions={actions}
              pageReturn={PAGE_RETURN}
              parentHref="/sessions"
              parentLabel="Sessions"
              title="A session with a long title that the bar cuts to fit"
            />
          ),
        },
      ],
      { initialEntries: [{ pathname: '/sessions/1', state }] },
    );
    act(() => {
      root.render(<RouterProvider router={router} />);
    });
  };

  test('leads Back to the parent page, shows the title cut to fit, and sits below the notch', () => {
    renderBar(null);

    const back = container.querySelector('a') as HTMLAnchorElement;
    expect(back.getAttribute('aria-label')).toBe('Back to Sessions');
    expect(back.getAttribute('href')).toBe('/sessions');
    expect(back.className).toContain('rounded-full');
    const title = container.querySelector('p') as HTMLParagraphElement;
    expect(title.textContent).toBe('A session with a long title that the bar cuts to fit');
    expect(title.className).toContain('truncate');
    const bar = container.querySelector('[data-slot="inner-page-bar"]') as HTMLElement;
    expect(bar.className).toContain('sticky');
    expect(bar.className).toContain('pt-[env(safe-area-inset-top)]');
    expect(bar.className).toContain(
      'min-h-[calc(var(--inner-page-bar-height,3.5rem)+env(safe-area-inset-top))]',
    );
    expect(bar.childElementCount).toBe(2);
  });

  test('leads Back to the page it was reached from, with the page actions at its end', () => {
    renderBar(PAGE_RETURN.createState('/plans'), <button type="button">Archive</button>);

    const back = container.querySelector('a') as HTMLAnchorElement;
    expect(back.getAttribute('aria-label')).toBe('Back to Plans');
    expect(back.getAttribute('href')).toBe('/plans');
    const bar = container.querySelector('[data-slot="inner-page-bar"]') as HTMLElement;
    expect(bar.lastElementChild?.textContent).toBe('Archive');
  });
});
