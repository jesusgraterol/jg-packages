import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from './index.js';

let container: HTMLDivElement;
let root: Root;
let transitionDescriptor: PropertyDescriptor | undefined;
let isMounted = false;

beforeEach(async () => {
  await page.viewport(320, 640);
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  transitionDescriptor = Object.getOwnPropertyDescriptor(document, 'startViewTransition');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  isMounted = true;
});

afterEach(async () => {
  if (isMounted)
    await act(async () => {
      await Promise.resolve();
      return root.unmount();
    });
  container.remove();
  if (transitionDescriptor === undefined) Reflect.deleteProperty(document, 'startViewTransition');
  else Object.defineProperty(document, 'startViewTransition', transitionDescriptor);
  document.documentElement.removeAttribute('data-dialog-return');
  vi.restoreAllMocks();
});

const createPendingPromise = () => {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const createSnapshot = () => {
  const ready = createPendingPromise();
  const finished = createPendingPromise();
  let update: (() => void | PromiseLike<void>) | undefined;
  const transition = {
    ready: ready.promise,
    finished: finished.promise,
    updateCallbackDone: Promise.resolve(),
    skipTransition: vi.fn(),
    types: new Set<string>(),
  } satisfies ViewTransition;
  const start = vi.fn((callback: () => void | PromiseLike<void>) => {
    update = callback;
    return transition;
  });
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: start });
  return {
    ready,
    finished,
    transition,
    start,
    capture: async () => {
      await update?.();
    },
  };
};

const renderDialog = async (
  open: boolean,
  onOpenChangeComplete = vi.fn<(open: boolean) => void>(),
) => {
  await act(async () => {
    await Promise.resolve();
    return root.render(
      createElement(
        Dialog,
        { open, onOpenChangeComplete },
        createElement(
          DialogContent,
          { size: 'medium' },
          createElement(DialogHeader, null, createElement(DialogTitle, null, 'Mobile workspace')),
          createElement(DialogBody, null, 'Workspace details'),
        ),
      ),
    );
  });
};

test('captures the outgoing mobile page and waits for native completion before releasing its marker', async () => {
  const snapshot = createSnapshot();
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  expect(snapshot.start).toHaveBeenCalledOnce();
  expect(document.documentElement.hasAttribute('data-dialog-return')).toBe(true);
  await act(async () => {
    await Promise.resolve();
    return snapshot.capture();
  });
  expect(completion).not.toHaveBeenCalledWith(false);
  await act(async () => {
    await Promise.resolve();
    snapshot.ready.resolve();
    snapshot.finished.resolve();
  });
  await vi.waitFor(() => expect(completion).toHaveBeenCalledWith(false));
  expect(document.documentElement.hasAttribute('data-dialog-return')).toBe(false);
  expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
});

test('skipped native snapshots may reject without preventing close completion', async () => {
  const snapshot = createSnapshot();
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  await act(async () => {
    await Promise.resolve();
    return snapshot.capture();
  });
  await act(async () => {
    await Promise.resolve();
    snapshot.ready.reject(new Error('Native capture skipped'));
    snapshot.finished.resolve();
  });
  await vi.waitFor(() => expect(completion).toHaveBeenCalledWith(false));
  expect(document.documentElement.hasAttribute('data-dialog-return')).toBe(false);
});

test('reopening cancels the old snapshot and ignores its late capture and completion', async () => {
  const snapshot = createSnapshot();
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  await renderDialog(true, completion);
  expect(snapshot.transition.skipTransition).toHaveBeenCalledOnce();
  await act(async () => {
    await snapshot.capture();
    snapshot.ready.resolve();
    snapshot.finished.resolve();
  });
  expect(
    document.body.querySelector('[data-slot="dialog-content"][data-state="open"]'),
  ).not.toBeNull();
  expect(completion).not.toHaveBeenCalledWith(false);
  expect(document.documentElement.hasAttribute('data-dialog-return')).toBe(false);
});

test('unmounting cancels the snapshot and does not clear another surface marker', async () => {
  const snapshot = createSnapshot();
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  document.documentElement.setAttribute('data-dialog-return', 'another-surface');
  await act(async () => {
    await Promise.resolve();
    return root.unmount();
  });
  isMounted = false;
  await act(async () => {
    await snapshot.capture();
    snapshot.ready.resolve();
    snapshot.finished.resolve();
  });
  expect(snapshot.transition.skipTransition).toHaveBeenCalledOnce();
  expect(completion).not.toHaveBeenCalledWith(false);
  expect(document.documentElement.getAttribute('data-dialog-return')).toBe('another-surface');
});

test('a native snapshot setup failure still closes the actual dialog', async () => {
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: () => {
      throw new Error('Native snapshot unavailable');
    },
  });
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  await vi.waitFor(() => expect(completion).toHaveBeenCalledWith(false));
  expect(document.documentElement.hasAttribute('data-dialog-return')).toBe(false);
});

test('browsers without the snapshot API dismiss the mobile page normally', async () => {
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: undefined });
  const completion = vi.fn<(open: boolean) => void>();
  await renderDialog(true, completion);
  await renderDialog(false, completion);
  await vi.waitFor(() => expect(completion).toHaveBeenCalledWith(false));
});
