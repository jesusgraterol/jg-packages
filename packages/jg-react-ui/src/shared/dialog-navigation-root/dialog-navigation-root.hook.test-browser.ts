import { act, createElement, Fragment, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { DialogNavigationProvider } from 'jg-react-router';

import { DialogNavigationObserver } from '../../components/dialog-navigation/index.js';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/dialog/index.js';
import {
  ConfirmationDialog,
  useConfirmationDialogStore,
} from '../../components/confirmation-dialog/index.js';

let root: Root;
let container: HTMLDivElement;
let router: ReturnType<typeof createMemoryRouter>;

beforeEach(async () => {
  await page.viewport(1280, 800);
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  router = createMemoryRouter([{ path: '*', element: createElement(DialogNavigationObserver) }], {
    initialEntries: ['/first'],
  });
});

afterEach(async () => {
  await act(async () => {
    await Promise.resolve();
    return root.unmount();
  });
  router.dispose();
  container.remove();
  useConfirmationDialogStore.setState(useConfirmationDialogStore.getInitialState(), true);
});

const panel = createElement(
  DialogContent,
  { size: 'medium' },
  createElement(DialogHeader, null, createElement(DialogTitle, null, 'Persistent dialog host')),
  createElement(DialogBody, null, createElement(DialogClose, null, 'Close session')),
);

const mount = async (children: ReactNode) => {
  await act(async () => {
    await Promise.resolve();
    return root.render(
      createElement(
        DialogNavigationProvider,
        null,
        createElement(Fragment, null, createElement(RouterProvider, { router }), children),
      ),
    );
  });
};

test('a provider imported from jg-react-router cancels an uncontrolled UI dialog even while dismissal is disabled', async () => {
  const change = vi.fn<(open: boolean) => void>();
  await mount(
    createElement(
      Dialog,
      { defaultOpen: true, isDismissalDisabled: true, onOpenChange: change },
      panel,
    ),
  );
  expect(document.body.querySelector('[data-slot="dialog-content"]')).not.toBeNull();
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/second');
  });
  expect(change).toHaveBeenCalledExactlyOnceWith(false);
  await vi.waitFor(() =>
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull(),
  );
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/third');
  });
  expect(change).toHaveBeenCalledOnce();
});

test('a controlled session owner closes on navigation and ordinary close updates remain controlled', async () => {
  const change = vi.fn<(open: boolean) => void>();
  const Host = () => {
    const [session, setSession] = useState<object | null>({});
    return createElement(
      Dialog,
      {
        open: session !== null,
        getNavigationSession: () => session,
        onOpenChange: (open) => {
          change(open);
          if (!open) setSession(null);
        },
      },
      panel,
    );
  };
  await mount(createElement(Host));
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/second');
  });
  expect(change).toHaveBeenCalledExactlyOnceWith(false);
  await vi.waitFor(() =>
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull(),
  );
});

test('already-open handles are seeded and closed handles are excluded from navigation', async () => {
  const handle = BaseDialog.createHandle();
  const change = vi.fn<(open: boolean) => void>();
  act(() => handle.open(null));
  await mount(createElement(Dialog, { handle, onOpenChange: change }, panel));
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/second');
  });
  expect(change).toHaveBeenCalledWith(false);
  expect(handle.isOpen).toBe(false);
  change.mockClear();
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/third');
  });
  expect(change).not.toHaveBeenCalled();
});

test('imperative confirmation sessions cancel rather than confirm when a committed route changes', async () => {
  const completion = vi.fn();
  await mount(createElement(ConfirmationDialog));
  await act(async () => {
    await Promise.resolve();
    return useConfirmationDialogStore
      .getState()
      .openConfirmationDialog({ title: 'Outgoing session', onConfirmationDialogClose: completion });
  });
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/second');
  });
  expect(completion).toHaveBeenCalledExactlyOnceWith(undefined);
  expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/third');
  });
  expect(completion).toHaveBeenCalledOnce();
});

test('an initially closed root does not emit callbacks, then trigger and explicit close retain the source aliases', async () => {
  const change = vi.fn<(open: boolean) => void>();
  await mount(
    createElement(
      Dialog,
      { onOpenChange: change },
      createElement(DialogTrigger, null, 'Open session'),
      panel,
    ),
  );
  await act(async () => {
    await Promise.resolve();
    return router.navigate('/second');
  });
  expect(change).not.toHaveBeenCalled();
  await act(async () => {
    await Promise.resolve();
    return container.querySelector<HTMLButtonElement>('[data-slot="dialog-trigger"]')?.click();
  });
  expect(change).toHaveBeenCalledWith(true);
  await act(async () => {
    await Promise.resolve();
    return document.body
      .querySelector<HTMLButtonElement>('[data-slot="dialog-body"] button')
      ?.click();
  });
  expect(change).toHaveBeenCalledWith(false);
});
