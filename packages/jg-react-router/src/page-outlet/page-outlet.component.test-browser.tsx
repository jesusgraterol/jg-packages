import { act, cleanup, render, screen } from '@testing-library/react';
import { type ReactElement, useLayoutEffect, useState } from 'react';
import { createMemoryRouter, type RouteObject, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';
import { cdp, server } from 'vitest/browser';

import { PAGE_OUTLET_SCROLL_HISTORY_LIMIT } from './constants.js';
import { PageOutlet } from './page-outlet.component.js';

// the routers a test created, disposed after it
const routers: ReturnType<typeof createMemoryRouter>[] = [];

// the height GrowingPage mounts with, and how a test makes the mounted one grow
let growingPageHeight = 3000;
let growPage: (height: number) => void = () => undefined;

afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) {
    router.dispose();
  }
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  window.history.scrollRestoration = 'auto';
  growingPageHeight = 3000;
});

const TallPage = ({ name }: { name: string }): ReactElement => (
  <p style={{ height: '3000px', margin: 0 }}>{name}</p>
);

const GrowingPage = (): ReactElement => {
  const [height, setHeight] = useState(growingPageHeight);
  useLayoutEffect(() => {
    growPage = setHeight;
  });
  return <p style={{ height: `${String(height)}px`, margin: 0 }}>growing</p>;
};

/**
 * Renders routes in a memory router.
 * @param routes The routes.
 * @param initialPath Where the router starts.
 * @returns The router.
 */
const renderRouter = (routes: RouteObject[], initialPath: string) => {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  routers.push(router);
  render(<RouterProvider router={router} />);
  return router;
};

/**
 * Builds an outlet whose child routes are tall pages, with /grow a page whose height a test sets.
 * @returns The routes.
 */
const createPageRoutes = (): RouteObject[] => [
  {
    path: '/',
    element: <PageOutlet />,
    children: [
      { path: 'grow', element: <GrowingPage /> },
      { path: ':name', element: <TallPage name="page" /> },
    ],
  },
];

/**
 * Gets the only outlet frame.
 * @returns The frame.
 */
const getFrame = (): HTMLElement => {
  const [frame, ...others] = document.querySelectorAll<HTMLElement>('.jg-page-outlet');
  if (frame === undefined || others.length > 0) {
    throw new Error('Expected exactly one outlet frame.');
  }
  return frame;
};

/**
 * Scrolls the window and waits for the scroll event the outlet records positions on.
 * @param top The position, which must differ from the current one.
 */
const scrollWindowTo = async (top: number): Promise<void> => {
  const scrolled = new Promise<void>((resolve) => {
    window.addEventListener(
      'scroll',
      () => {
        resolve();
      },
      { once: true },
    );
  });
  window.scrollTo({ left: 0, top, behavior: 'instant' });
  await scrolled;
};

/**
 * Waits two animation frames, long enough for resize observers and scroll events to run.
 */
const waitForFrames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

/**
 * Leaves /grow scrolled to 1500 for another page, and comes Back to it while it's 100 pixels tall,
 * so its restore is pending.
 * @returns The router.
 */
const returnToShortPage = async () => {
  const router = renderRouter(createPageRoutes(), '/grow');
  await scrollWindowTo(1500);
  await act(() => router.navigate('/other'));
  expect(window.scrollY).toBe(0);
  growingPageHeight = 100;
  await act(() => router.navigate(-1));
  expect(screen.getByText('growing')).toBeInstanceOf(HTMLElement);
  expect(window.scrollY).toBe(0);
  return router;
};

describe('PageOutlet', () => {
  test('keeps the frame and its scroll when only the query changes', async () => {
    const router = renderRouter(createPageRoutes(), '/a');
    await scrollWindowTo(500);
    const frame = getFrame();

    await act(() => router.navigate('/a?tab=2'));

    expect(getFrame()).toBe(frame);
    expect(window.scrollY).toBe(500);
  });

  test('remounts the frame, focuses it, and scrolls to the top when the pathname changes', async () => {
    const router = renderRouter(createPageRoutes(), '/a');
    await scrollWindowTo(500);
    const frame = getFrame();

    await act(() => router.navigate('/b'));

    const next = getFrame();
    expect(next).not.toBe(frame);
    expect(document.activeElement).toBe(next);
    expect(window.scrollY).toBe(0);
  });

  test('restores the position on Back, retrying while the content grows', async () => {
    await returnToShortPage();

    act(() => {
      growPage(3000);
    });

    await expect.poll(() => window.scrollY).toBe(1500);
  });

  test.each([
    ['wheel', () => new WheelEvent('wheel', { deltaY: 40 })],
    ['keydown', () => new KeyboardEvent('keydown', { key: 'ArrowDown' })],
  ])('cancels a pending restore on %s', async (_, createEvent) => {
    await returnToShortPage();

    window.dispatchEvent(createEvent());
    act(() => {
      growPage(3000);
    });
    await waitForFrames();

    expect(window.scrollY).toBe(0);
  });

  test('keeps history.scrollRestoration manual across nested outlets until the last one unmounts', async () => {
    window.history.scrollRestoration = 'auto';
    const router = renderRouter(
      [
        {
          path: '/',
          element: <PageOutlet />,
          children: [
            {
              path: 'nested',
              element: <PageOutlet />,
              children: [{ index: true, element: <TallPage name="nested" /> }],
            },
            { path: 'flat', element: <TallPage name="flat" /> },
          ],
        },
      ],
      '/nested',
    );
    expect(document.querySelectorAll('.jg-page-outlet')).toHaveLength(2);
    expect(window.history.scrollRestoration).toBe('manual');

    await act(() => router.navigate('/flat'));

    expect(document.querySelectorAll('.jg-page-outlet')).toHaveLength(1);
    expect(window.history.scrollRestoration).toBe('manual');

    cleanup();

    expect(window.history.scrollRestoration).toBe('auto');
  });

  test('keeps the frame across nested routes that share a transitionKey', async () => {
    const router = renderRouter(
      [
        {
          path: '/settings',
          element: <PageOutlet transitionKey="settings" />,
          children: [
            { path: 'profile', element: <TallPage name="profile" /> },
            { path: 'billing', element: <TallPage name="billing" /> },
          ],
        },
      ],
      '/settings/profile',
    );
    await scrollWindowTo(500);
    const frame = getFrame();

    await act(() => router.navigate('/settings/billing'));

    expect(screen.getByText('billing')).toBeInstanceOf(HTMLElement);
    expect(getFrame()).toBe(frame);
    expect(window.scrollY).toBe(500);
  });

  test.each([
    [PAGE_OUTLET_SCROLL_HISTORY_LIMIT - 1, 700],
    [PAGE_OUTLET_SCROLL_HISTORY_LIMIT, 0],
  ])('after %d more pages, Back to the first one scrolls to %d', async (pages, expectedTop) => {
    const router = renderRouter(createPageRoutes(), '/0');
    await scrollWindowTo(700);
    for (let page = 1; page <= pages; page += 1) {
      await act(() => router.navigate(`/${String(page)}`));
    }
    expect(window.scrollY).toBe(0);

    await act(() => router.navigate(-pages));

    expect(window.scrollY).toBe(expectedTop);
  });

  test('joins its className to the frame class', () => {
    renderRouter([{ path: '/', element: <PageOutlet className="app-main" />, children: [] }], '/');

    expect(getFrame().className).toBe('jg-page-outlet app-main');
  });
});

describe('styles.css', () => {
  /**
   * Adds the package's stylesheet to the page for one test.
   * @returns A promise that resolves to the function that removes it.
   */
  const addStylesheet = async (): Promise<() => void> => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./styles.css', import.meta.url).href;
    const loaded = new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => {
        resolve();
      });
      link.addEventListener('error', () => {
        reject(new Error('styles.css failed to load.'));
      });
    });
    document.head.append(link);
    await loaded;
    return () => {
      link.remove();
    };
  };

  test('fades each page in, for 180 ms', async () => {
    const removeStylesheet = await addStylesheet();
    try {
      renderRouter(createPageRoutes(), '/a');

      const style = getComputedStyle(getFrame());
      expect(style.animationName).toBe('jg-page-outlet-fade');
      expect(style.animationDuration).toBe('0.18s');
      expect(style.width).toBe(`${String(document.body.clientWidth)}px`);
    } finally {
      removeStylesheet();
    }
  });

  // only Chromium lets a test emulate the reduced-motion preference, through its DevTools protocol
  test.runIf(server.browser === 'chromium')('turns the fade off for reduced motion', async () => {
    const removeStylesheet = await addStylesheet();
    const session = cdp();
    try {
      renderRouter(createPageRoutes(), '/a');
      await session.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
      });

      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
      expect(getComputedStyle(getFrame()).animationName).toBe('none');
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] });
      removeStylesheet();
    }
  });
});
