import { cleanup, render, screen } from '@testing-library/react';
import { hasErrorCode } from 'jg-exception';
import { createMemoryRouter, RouterProvider, useRouteError } from 'react-router';
import { afterEach, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { createLazyRoute } from './route-module.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

// a lazy route's script that a newer build replaced
const MISSING_SCRIPT = '/assets/settings-replaced-by-a-newer-build.js';

// the route's error element: a reload notice for code that couldn't load, the error otherwise
const RouteError = () => {
  const error = useRouteError();
  return (
    <p>
      {hasErrorCode(error, ERRORS.ROUTE_MODULE_UNAVAILABLE)
        ? 'This page opens once the app reloads.'
        : 'Something else went wrong.'}
    </p>
  );
};

test("shows the route's error element when its module fails to load, and the page when it loads", async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/gone',
        errorElement: <RouteError />,
        lazy: createLazyRoute(
          // a real import of a script the server no longer has, as after a deploy
          () => import(/* @vite-ignore */ MISSING_SCRIPT) as Promise<{ SettingsPage: () => null }>,
          (module) => module.SettingsPage,
        ),
      },
      {
        path: '/settings',
        errorElement: <RouteError />,
        lazy: createLazyRoute(
          () => Promise.resolve({ SettingsPage: () => <h1>Settings</h1> }),
          (module) => module.SettingsPage,
        ),
      },
    ],
    { initialEntries: ['/gone'] },
  );
  render(<RouterProvider router={router} />);

  expect(await screen.findByText('This page opens once the app reloads.')).toBeVisible();

  await router.navigate('/settings');
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeVisible();
});
