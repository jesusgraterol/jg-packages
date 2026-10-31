import { act, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { getByRole, queryByRole } from '@testing-library/dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '../dialog/index.js';
import { DialogNavigationProvider } from '../dialog-navigation/index.js';
import { GlobalErrorBoundary } from '../global-error-boundary/index.js';

import { RouterRoot } from './index.js';

/** Exercises navigation cancellation while ordinary user dismissal is disabled. */
const BusyDialog = () => {
  const [isOpen, setIsOpen] = useState(true);
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
      >
        Reopen draft
      </button>
      <Dialog
        open={isOpen}
        isDismissalDisabled
        onOpenChange={setIsOpen}
      >
        <DialogContent size="small">
          <DialogHeader>
            <DialogTitle>Unsaved draft</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <input aria-label="Draft" />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;
beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  router.dispose();
  container.remove();
  vi.restoreAllMocks();
  await vi.waitFor(() => expect(document.body.style.position).not.toBe('fixed'));
});

test('pending and abandoned navigation preserve the live dialog; a committed destination cancels it', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  router = createMemoryRouter([
    {
      element: <RouterRoot />,
      children: [
        { path: '/', element: <h1>Current route</h1> },
        { path: '/pending', loader: () => pending, element: <h1>Pending destination</h1> },
        { path: '/next', element: <h1>Committed destination</h1> },
      ],
    },
  ]);
  await act(async () => {
    root.render(
      <DialogNavigationProvider>
        <BusyDialog />
        <RouterProvider router={router} />
      </DialogNavigationProvider>,
    );
    await Promise.resolve();
  });
  await vi.waitFor(() =>
    expect(queryByRole(document.body, 'dialog', { name: 'Unsaved draft' })).not.toBeNull(),
  );
  const navigate = router.navigate('/pending');
  await vi.waitFor(() =>
    // the open modal intentionally hides background announcements from assistive technology.
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe(
      'Loading route',
    ),
  );
  expect(getByRole(document.body, 'dialog', { name: 'Unsaved draft' })).toBeVisible();
  const revalidation = router.revalidate();
  await act(async () => {
    await Promise.resolve();
  });
  expect(getByRole(document.body, 'dialog', { name: 'Unsaved draft' })).toBeVisible();
  await act(async () => {
    await router.navigate('/next');
  });
  await vi.waitFor(() =>
    expect(getByRole(container, 'heading', { name: 'Committed destination' })).toBeVisible(),
  );
  await vi.waitFor(() => expect(queryByRole(document.body, 'dialog')).toBeNull());
  expect(queryByRole(container, 'progressbar')).toBeNull();
  await act(async () => {
    finish();
    await navigate;
    await revalidation;
  });
  expect(router.state.location.pathname).toBe('/next');
});

test('a same-entry loader error cancels sessions and safe recovery establishes a fresh route', async () => {
  let shouldFail = false;
  const recoveryReference = createRef<HTMLElement>();
  const refresh = vi.fn(async () => {
    shouldFail = false;
    await router.revalidate();
  });
  router = createMemoryRouter([
    {
      element: <RouterRoot />,
      errorElement: (
        <GlobalErrorBoundary
          ref={recoveryReference}
          onRefreshClick={refresh}
        />
      ),
      children: [
        {
          path: '/',
          loader: () => {
            if (shouldFail) throw new Error('PRIVATE DATABASE CONNECTION');
            return null;
          },
          element: <h1>Current route</h1>,
        },
      ],
    },
  ]);
  await act(async () => {
    root.render(
      <DialogNavigationProvider>
        <BusyDialog />
        <RouterProvider router={router} />
      </DialogNavigationProvider>,
    );
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(queryByRole(document.body, 'dialog')).not.toBeNull());
  shouldFail = true;
  await act(async () => {
    await router.revalidate();
  });
  await vi.waitFor(() => expect(queryByRole(document.body, 'dialog')).toBeNull());
  expect(getByRole(container, 'heading', { name: 'Something went wrong' })).toBeVisible();
  expect(container.textContent).toContain('Error code: Unknown');
  expect(container.textContent).not.toContain('PRIVATE DATABASE');
  expect(getByRole(container, 'main')).toHaveFocus();
  expect(recoveryReference.current).toBe(getByRole(container, 'main'));
  await act(async () => {
    getByRole(container, 'button', { name: 'Refresh app' }).click();
    await Promise.resolve();
  });
  await vi.waitFor(() =>
    expect(getByRole(container, 'heading', { name: 'Current route' })).toBeVisible(),
  );
  expect(queryByRole(document.body, 'dialog')).toBeNull();
  act(() => getByRole(container, 'button', { name: 'Reopen draft' }).click());
  await vi.waitFor(() =>
    expect(queryByRole(document.body, 'dialog', { name: 'Unsaved draft' })).not.toBeNull(),
  );
  expect(refresh).toHaveBeenCalledOnce();
  expect(queryByRole(container, 'heading', { name: 'Something went wrong' })).toBeNull();
  expect(recoveryReference.current).toBeNull();
});
