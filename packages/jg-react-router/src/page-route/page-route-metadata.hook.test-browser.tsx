import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, Outlet, type RouteObject, RouterProvider } from 'react-router';
import { afterEach, describe, expect, test } from 'vitest';

import { usePageRouteMetadata } from './page-route-metadata.hook.js';
import { createPageRouteHandle } from './utilities.js';

// the routers a test created, disposed after it
const routers: ReturnType<typeof createMemoryRouter>[] = [];

afterEach(() => {
  cleanup();
  for (const router of routers.splice(0)) {
    router.dispose();
  }
});

// shows the matched page's title, or that none matched, then the child route
const Layout = (): ReactElement => {
  const pageMetadata = usePageRouteMetadata();
  return (
    <>
      <p data-testid="title">{pageMetadata === null ? 'No page' : pageMetadata.title}</p>
      <Outlet />
    </>
  );
};

/**
 * Renders routes in a memory router at a path.
 * @param routes The routes.
 * @param path The path.
 */
const renderAt = (routes: RouteObject[], path: string): void => {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  routers.push(router);
  render(<RouterProvider router={router} />);
};

// a layout that's a page itself, with children that are pages, aren't, or have broken handles
const ROUTES: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    handle: createPageRouteHandle({ title: 'Home', description: 'The dashboard.' }),
    children: [
      {
        path: 'settings',
        handle: createPageRouteHandle({ title: 'Settings', description: 'Your account.' }),
        element: <p>Settings page</p>,
      },
      { path: 'number-title', handle: { pageMetadata: { title: 7, description: 'Bad.' } } },
      { path: 'no-metadata', handle: { pageMetadata: null } },
      { path: 'string-handle', handle: 'settings' },
      { path: 'plain', element: <p>Plain page</p> },
    ],
  },
];

describe('usePageRouteMetadata', () => {
  test('gives the deepest matched page route', async () => {
    renderAt(ROUTES, '/settings');

    expect(await screen.findByText('Settings page')).toBeDefined();
    expect(screen.getByTestId('title').textContent).toBe('Settings');
  });

  test.each(['/number-title', '/no-metadata', '/string-handle', '/plain'])(
    'skips the handle of %s for the nearest page route above it',
    async (path) => {
      renderAt(ROUTES, path);

      expect((await screen.findByTestId('title')).textContent).toBe('Home');
    },
  );

  test('gives null when no matched route is a page route', async () => {
    renderAt([{ path: '/', element: <Layout /> }], '/');

    expect((await screen.findByTestId('title')).textContent).toBe('No page');
  });
});
