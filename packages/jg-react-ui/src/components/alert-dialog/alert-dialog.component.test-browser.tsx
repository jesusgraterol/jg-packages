import type * as React from 'react';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './index.js';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog/index.js';
import { Button } from '../button/index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/** Renders alert-dialog children that parent state clears during close. */
const SessionAlertDialog = (): React.ReactElement => {
  const [sessionTitle, setSessionTitle] = useState<string | null>('Active decision');

  return (
    <>
      <button
        type="button"
        onClick={() => setSessionTitle(null)}
      >
        Close alert dialog
      </button>
      <AlertDialog open={sessionTitle !== null}>
        {sessionTitle === null ? null : <span data-slot="alert-session">{sessionTitle}</span>}
      </AlertDialog>
    </>
  );
};

describe('AlertDialog', () => {
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

  test('slotted triggers and actions retain native button semantics and callback aliases', async () => {
    const changes: boolean[] = [];
    const completions: boolean[] = [];
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <AlertDialog
          onOpenChange={(open) => changes.push(open)}
          onOpenChangeComplete={(open) => completions.push(open)}
        >
          <AlertDialogTrigger asChild>
            <Button>Review change</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply change?</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction asChild>
                <Button>Apply change</Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );
    });
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-slot="alert-dialog-trigger"]',
    );
    expect(trigger?.getAttribute('role')).toBeNull();
    await act(async () => {
      await Promise.resolve();
      return trigger?.click();
    });
    await expect.poll(() => completions).toContain(true);
    await act(async () => {
      await Promise.resolve();
      return document.body
        .querySelector<HTMLButtonElement>('[data-slot="alert-dialog-action"]')
        ?.click();
    });
    expect(changes).toStrictEqual([true, false]);
    await expect.poll(() => completions).toStrictEqual([true, false]);
  });

  test('preserves the last open children while a controlled alert dialog closes', () => {
    act(() => {
      root.render(<SessionAlertDialog />);
    });

    const closeButton = container.querySelector<HTMLButtonElement>('button');

    act(() => closeButton?.click());

    expect(container.querySelector('[data-slot="alert-session"]')?.textContent).toBe(
      'Active decision',
    );
  });

  test('provides reduced-motion behavior for the alert panel and overlay', () => {
    act(() => {
      root.render(
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Download database backup?</AlertDialogTitle>
              <AlertDialogDescription>Review the change before continuing.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );
    });

    const dialogContent = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-content"]',
    );
    const dialogOverlay = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-overlay"]',
    );

    expect(dialogContent?.className).toContain('motion-reduce:animate-none');
    expect(dialogContent?.className).toContain('motion-reduce:data-open:animate-none');
    expect(dialogContent?.className).toContain('motion-reduce:data-closed:animate-none');
    expect(dialogContent?.className).toContain('z-[60]');
    expect(dialogOverlay?.className).toContain('motion-reduce:animate-none');
    expect(dialogOverlay?.className).toContain('motion-reduce:data-open:animate-none');
    expect(dialogOverlay?.className).toContain('motion-reduce:data-closed:animate-none');
    expect(dialogOverlay?.className).toContain('z-[60]');
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[data-slot="alert-dialog-close"]',
    );
    const dialogTitle = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-title"]',
    );

    expect(closeButton?.getAttribute('aria-label')).toBe('Close dialog');
    expect(closeButton?.className).toContain('size-7');
    expect(closeButton?.className).not.toContain('size-11');
    expect(closeButton?.className).toContain('absolute');
    expect(closeButton?.className).toContain('after:-inset-2');
    expect(dialogTitle?.className).toContain('px-8');
  });

  test('keeps compact alert content scrollable above fixed actions', () => {
    act(() => {
      root.render(
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm change</AlertDialogTitle>
              <AlertDialogDescription>Review the change before continuing.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Continue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );
    });

    const dialogContent = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-content"]',
    );
    const dialogHeader = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-header"]',
    );
    const dialogFooter = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-footer"]',
    );

    expect(dialogContent?.className).toContain('max-w-80');
    expect(dialogContent?.className).toContain('overflow-hidden');
    expect(dialogHeader?.className).toContain('overflow-y-auto');
    expect(dialogFooter?.className).toContain('shrink-0');
    expect(dialogFooter?.className).toContain('*:w-full');
  });

  test('keeps a nested alert above its parent and focuses within the alert', async () => {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <Dialog open>
          <DialogContent size="medium">
            <DialogHeader>
              <DialogTitle>Parent operation</DialogTitle>
              <DialogDescription>Review the operation.</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <AlertDialog>
                <AlertDialogTrigger>Open confirmation</AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm nested operation</AlertDialogTitle>
                    <AlertDialogDescription>Confirm before continuing.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogAction>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    const trigger = document.body.querySelector<HTMLButtonElement>(
      '[data-slot="alert-dialog-trigger"]',
    );

    await act(async () => {
      await Promise.resolve();
      return trigger?.click();
    });

    const parentContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const alertContent = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-content"]',
    );
    const alertOverlay = document.body.querySelector<HTMLElement>(
      '[data-slot="alert-dialog-overlay"]',
    );

    expect(parentContent?.className).toContain('z-50');
    expect(alertContent?.className).toContain('z-[60]');
    expect(alertOverlay?.className).toContain('z-[60]');
    await vi.waitFor(() => expect(alertContent?.contains(document.activeElement)).toBe(true));
    expect(parentContent?.contains(document.activeElement)).toBe(false);
  });

  test('rejects alert dialogs without both mandatory regions', () => {
    expect(() => {
      act(() => {
        root.render(
          <AlertDialog open>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm change</AlertDialogTitle>
              </AlertDialogHeader>
            </AlertDialogContent>
          </AlertDialog>,
        );
      });
    }).toThrowError(
      'AlertDialogContent requires direct AlertDialogHeader and AlertDialogFooter children.',
    );
  });
});
