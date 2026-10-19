import { act, cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, expect, test } from 'vitest';

import { createPageReturn } from './page-return.js';
import { usePageReturn } from './page-return.hook.js';
import type { IPageReturnResolution } from './types.js';

afterEach(() => {
  // Vitest runs without globals here, so Testing Library can't unmount on its own
  cleanup();
});

const pageReturn = createPageReturn({
  resolveOrigin: (url) =>
    url.pathname === '/payments' ? { href: `/payments${url.search}`, label: 'Payments' } : null,
});

test('resolves the way back from the location the page was reached with, and uses it once', async () => {
  const results: IPageReturnResolution[] = [];
  const Detail = () => {
    results.push(usePageReturn(pageReturn, { parentHref: '/payments' }));
    return null;
  };
  const router = createMemoryRouter(
    [
      { path: '/payments', element: null },
      { path: '/payments/:id', element: <Detail /> },
    ],
    { initialEntries: ['/payments?status=failed'] },
  );
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );

  await act(async () => {
    await router.navigate('/payments/41', {
      state: pageReturn.createState('/payments?status=failed', { scrollY: 120 }),
    });
  });
  const { returnTo, returnState } = results.at(-1) as IPageReturnResolution;
  expect(returnTo).toStrictEqual({ href: '/payments?status=failed', label: 'Payments' });
  expect(returnState).toStrictEqual({ scrollY: 120 });

  await act(async () => {
    await router.navigate(returnTo?.href ?? '', { state: returnState });
  });
  expect(router.state.location).toMatchObject({
    search: '?status=failed',
    state: { scrollY: 120 },
  });
  expect(
    pageReturn.resolve(router.state.location.state, '/payments?status=failed').returnTo,
  ).toBeNull();
});
