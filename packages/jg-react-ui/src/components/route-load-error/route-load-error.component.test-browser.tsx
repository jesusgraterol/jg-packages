import type { ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, Outlet, RouterProvider, useRouteError } from 'react-router';
import { createLazyRoute } from 'jg-react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { RouteLoadError } from './route-load-error.component.js';
import type { IRouteLoadErrorProps } from './types.js';

/*
 * The router loads the page and renders its error after a real failed import, outside any act
 * scope, so these tests run React outside the act environment and wait for what it renders.
 */
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// what a browser rejects the import of a script that a newer build replaced with
const MISSING_SCRIPT = new TypeError(
  'Failed to fetch dynamically imported module: /assets/settings-old.js',
);

/** The app's own error boundary, which a page's other errors reach. */
const AppError = (): ReactElement => {
  const error = useRouteError();
  return <p>App error: {error instanceof Error ? error.message : 'unknown'}</p>;
};

describe('RouteLoadError', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    Reflect.deleteProperty(navigator, 'onLine');
    document.title = '';
  });

  /**
   * Renders a router whose settings page fails to load its code, or throws its own error.
   * @param props The notice's options.
   * @param failure How the page fails.
   */
  const renderFailedPage = async (
    props: IRouteLoadErrorProps,
    failure: 'missing-script' | 'page-error' = 'missing-script',
  ) => {
    // as an app places it: on a pathless group of pages inside its layout
    const router = createMemoryRouter(
      [
        {
          Component: Outlet,
          errorElement: <AppError />,
          children: [
            {
              errorElement: <RouteLoadError {...props} />,
              children: [
                {
                  path: '/settings',
                  lazy:
                    failure === 'missing-script'
                      ? createLazyRoute(
                          (): Promise<{ SettingsPage: () => null }> =>
                            Promise.reject(MISSING_SCRIPT),
                          (module) => module.SettingsPage,
                        )
                      : createLazyRoute(
                          () =>
                            Promise.resolve({
                              SettingsPage: () => {
                                throw new Error('The settings could not be read');
                              },
                            }),
                          (module) => module.SettingsPage,
                        ),
                },
              ],
            },
          ],
        },
      ],
      { initialEntries: ['/settings'] },
    );
    root.render(<RouterProvider router={router} />);
    await Promise.resolve();
  };

  test('says the page opens once the app reloads, named in the document title, and reloads on request', async () => {
    const handleReload = vi.fn<() => void>();
    await renderFailedPage({ appName: 'Acme', onReload: handleReload });

    const notice = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-slot="route-load-error"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(notice.textContent).toContain('The app was updated');
    expect(notice.textContent).toContain('opens once the app reloads');
    expect(notice.querySelector('[data-illustration]')).toBeNull();
    await vi.waitFor(() => {
      expect(document.title).toBe('The app was updated · Acme');
    });
    const reload = notice.querySelector('button') as HTMLButtonElement;
    expect(reload.textContent).toBe('Reload');

    reload.click();

    expect(handleReload).toHaveBeenCalledOnce();
  });

  test('says the page opens once the browser is back online, with its illustration', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    await renderFailedPage({ onReload: () => undefined });

    const notice = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-slot="route-load-error"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(notice.textContent).toContain("You're offline");
    expect(notice.querySelector('[data-illustration="offline"]')).not.toBeNull();
    await vi.waitFor(() => {
      expect(document.title).toBe("You're offline");
    });
  });

  test("takes the app's own copy", async () => {
    await renderFailedPage({
      onReload: () => undefined,
      messages: {
        updated: { title: 'HQ was updated', description: 'Reload to open it.' },
        reload: 'Reload HQ',
      },
    });

    const notice = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-slot="route-load-error"]');
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    expect(notice.textContent).toContain('HQ was updated');
    expect(notice.textContent).toContain('Reload to open it.');
    expect(notice.querySelector('button')?.textContent).toBe('Reload HQ');
  });

  test("passes a page's own error on to the next error boundary", async () => {
    await renderFailedPage({ onReload: () => undefined }, 'page-error');

    await vi.waitFor(() => {
      expect(container.textContent).toBe('App error: The settings could not be read');
    });
    expect(container.querySelector('[data-slot="route-load-error"]')).toBeNull();
  });
});
