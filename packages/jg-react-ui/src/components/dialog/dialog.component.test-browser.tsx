import { useState, useEffect } from 'react';
import type * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { Alert, AlertDescription, AlertTitle } from '../alert/index.js';
import { Button } from '../button/index.js';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// props for the controlled dialog test fixture.
type ITestDialogProps = {
  isOverlayCloseEnabled?: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Renders a controlled dialog fixture for shared dismissal behavior tests.
 * @param props The overlay dismissal option and open-state handler.
 * @returns A React element that renders the test dialog.
 */
const TestDialog = ({
  isOverlayCloseEnabled,
  onOpenChange,
}: ITestDialogProps): React.ReactElement => (
  <Dialog
    {...(isOverlayCloseEnabled === undefined ? {} : { isOverlayCloseEnabled })}
    open
    onOpenChange={onOpenChange}
  >
    <DialogContent size="medium">
      <DialogHeader>
        <DialogTitle>Dialog behavior</DialogTitle>
        <DialogDescription>Shared dialog dismissal behavior.</DialogDescription>
      </DialogHeader>
      <DialogBody>Dialog body</DialogBody>
    </DialogContent>
  </Dialog>
);

type INestedOverlayDialogProps = {
  isNestedOverlayCloseEnabled?: boolean;
  onNestedOpenChange: (open: boolean) => void;
  onParentOpenChange: (open: boolean) => void;
};

/** Renders two open dialogs to verify topmost nested overlay dismissal. */
const NestedOverlayDialog = ({
  isNestedOverlayCloseEnabled = true,
  onNestedOpenChange,
  onParentOpenChange,
}: INestedOverlayDialogProps): React.ReactElement => (
  <Dialog
    isOverlayCloseEnabled
    open
    onOpenChange={onParentOpenChange}
  >
    <DialogContent size="medium">
      <DialogHeader>
        <DialogTitle>Parent dialog</DialogTitle>
      </DialogHeader>
      <DialogBody>Parent body</DialogBody>
    </DialogContent>

    <Dialog
      isOverlayCloseEnabled={isNestedOverlayCloseEnabled}
      open
      onOpenChange={onNestedOpenChange}
    >
      <DialogContent size="medium">
        <DialogHeader>
          <DialogTitle>Nested dialog</DialogTitle>
        </DialogHeader>
        <DialogBody>Nested body</DialogBody>
      </DialogContent>
    </Dialog>
  </Dialog>
);

// props for the controlled session retention fixture.
type ISessionDialogProps = {
  onOpenChangeComplete?: (open: boolean) => void;
};

/** Renders session content that is cleared by the controlled close-state update. */
const SessionDialog = ({ onOpenChangeComplete }: ISessionDialogProps): React.ReactElement => {
  const [sessionTitle, setSessionTitle] = useState<string | null>('Active session');

  return (
    <Dialog
      open={sessionTitle !== null}
      {...(onOpenChangeComplete === undefined ? {} : { onOpenChangeComplete })}
      onOpenChange={(open) => {
        if (!open) {
          setSessionTitle(null);
        }
      }}
    >
      {sessionTitle === null ? null : (
        <DialogContent
          forceMount
          size="medium"
        >
          <DialogHeader>
            <DialogTitle>{sessionTitle}</DialogTitle>
            <DialogDescription>Session content remains stable during close.</DialogDescription>
          </DialogHeader>
          <DialogBody>Session body</DialogBody>
        </DialogContent>
      )}
    </Dialog>
  );
};

/** Renders payload-function children through controlled close and reopen transitions. */
const PayloadChildrenDialog = (): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('Initial session');

  return (
    <>
      <button
        type="button"
        onClick={() => setSessionTitle('Latest session')}
      >
        Update session
      </button>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
      >
        Close from parent
      </button>
      <button
        type="button"
        onClick={() => {
          setSessionTitle('Reopened session');
          setIsOpen(true);
        }}
      >
        Reopen session
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        {() => (
          <DialogContent
            forceMount
            size="medium"
          >
            <DialogHeader>
              <DialogTitle>{sessionTitle}</DialogTitle>
              <DialogDescription>Payload children remain supported.</DialogDescription>
            </DialogHeader>
            <DialogBody>Payload body</DialogBody>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
};

/** Renders controlled closed children that update after the first render. */
const InitiallyClosedDialog = (): React.ReactElement => {
  const [status, setStatus] = useState('Loading');

  useEffect(() => {
    setStatus('Ready');
  }, []);

  return (
    <Dialog open={false}>
      <span data-slot="closed-dialog-status">{status}</span>
    </Dialog>
  );
};

/**
 * Returns the mounted dialog overlay.
 * @returns The rendered dialog overlay element.
 */
const getDialogOverlay = (): HTMLElement => {
  const overlay = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]');

  if (overlay === null) {
    throw new Error('Dialog overlay was not found.');
  }

  return overlay;
};

/**
 * Dispatches the pointer and click events the dialog primitive uses to dismiss outside interactions.
 * @param overlay The overlay that owns the outside interaction.
 */
const clickDialogOverlay = (overlay = getDialogOverlay()): void => {
  overlay.dispatchEvent(
    new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    }),
  );
  overlay.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      button: 0,
      cancelable: true,
    }),
  );
};

/**
 * Waits for the dialog primitive to attach document-level outside interaction listeners.
 * @returns A promise that resolves after the listener setup tick.
 */
const waitForOutsideInteractionListeners = async (): Promise<void> => {
  await Promise.resolve();
};

/**
 * Returns the first rendered button in the mounted dialog trigger fixture.
 * @param container The React root container.
 * @returns The native button rendered by the trigger fixture.
 */
const getRenderedTriggerButton = (container: HTMLElement): HTMLButtonElement => {
  const triggerButton = container.querySelector('button');

  if (!(triggerButton instanceof HTMLButtonElement)) {
    throw new Error('Dialog trigger button was not found.');
  }

  return triggerButton;
};

describe('DialogContent', () => {
  let container: HTMLDivElement;
  let getAnimationsDescriptor: PropertyDescriptor | undefined;
  let root: Root;

  beforeEach(async () => {
    await page.viewport(1280, 800);
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    getAnimationsDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  test('focuses the first usable body control instead of the generated close button', async () => {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <Dialog open>
          <DialogContent size="small">
            <DialogHeader>
              <DialogTitle>Edit member</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <input
                aria-label="Unavailable"
                disabled
              />
              <input aria-label="Role" />
              <button type="button">Save</button>
            </DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    await vi.waitFor(() => {
      expect(document.activeElement).toBe(document.querySelector('[aria-label="Role"]'));
    });
  });

  test('skips hidden, inert, disabled and visually hidden controls before choosing body focus', async () => {
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <Dialog open>
          <DialogContent size="medium">
            <DialogHeader>
              <DialogTitle>Accessible focus order</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <input
                aria-label="Hidden input"
                type="hidden"
              />
              <input
                aria-label="Skipped tab stop"
                tabIndex={-1}
              />
              <div hidden>
                <button>Hidden ancestor</button>
              </div>
              <div inert>
                <button>Inert ancestor</button>
              </div>
              <div aria-hidden="true">
                <button>Hidden from accessibility</button>
              </div>
              <button aria-disabled="true">Aria disabled</button>
              <div style={{ display: 'none' }}>
                <button>Display none</button>
              </div>
              <div style={{ visibility: 'hidden' }}>
                <button>Invisible</button>
              </div>
              <input aria-label="Available field" />
            </DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(document.querySelector('[aria-label="Available field"]')),
    );
  });

  test('blocks Escape while busy and allows cancellation after the busy state clears', async () => {
    const change = vi.fn<(open: boolean) => void>();
    const content = (
      <DialogContent size="small">
        <DialogHeader>
          <DialogTitle>Pending work</DialogTitle>
        </DialogHeader>
        <DialogBody>Saving changes</DialogBody>
      </DialogContent>
    );
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <Dialog
          open
          isDismissalDisabled
          onOpenChange={change}
        >
          {content}
        </Dialog>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      return document.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      );
    });
    expect(change).not.toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
      return root.render(
        <Dialog
          open
          onOpenChange={change}
        >
          {content}
        </Dialog>,
      );
    });
    await act(async () => {
      await Promise.resolve();
      return document.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' }),
      );
    });
    expect(change).toHaveBeenCalledExactlyOnceWith(false);
  });

  test.each([
    ['split', true, true, true],
    ['split', false, false, true],
    ['split', false, true, false],
    ['centered', true, true, true],
    ['centered', true, true, false],
  ] as const)(
    'compact %s headers preserve leading=%s actions=%s close=%s',
    async (layout, hasLeading, hasActions, isCloseButtonVisible) => {
      const leading = vi.fn();
      const action = vi.fn();
      const change = vi.fn();
      await act(async () => {
        await Promise.resolve();
        return root.render(
          <Dialog
            open
            onOpenChange={change}
          >
            <DialogContent
              size="small"
              isCloseButtonVisible={isCloseButtonVisible}
            >
              <DialogHeader
                layout={layout}
                leadingAction={
                  hasLeading ? (
                    <button
                      aria-label="Return to category"
                      onClick={leading}
                    >
                      Return
                    </button>
                  ) : undefined
                }
                actions={
                  hasActions ? (
                    <button
                      aria-label="Refresh details"
                      onClick={action}
                    >
                      Refresh
                    </button>
                  ) : undefined
                }
              >
                <DialogTitle>Compact workspace</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <input aria-label="Editable workspace" />
              </DialogBody>
            </DialogContent>
          </Dialog>,
        );
      });
      await vi.waitFor(() =>
        expect(document.activeElement).toBe(
          document.querySelector('[aria-label="Editable workspace"]'),
        ),
      );
      const leadingControl = document.body.querySelector<HTMLButtonElement>(
        '[aria-label="Return to category"]',
      );
      const actionControl = document.body.querySelector<HTMLButtonElement>(
        '[aria-label="Refresh details"]',
      );
      if (hasLeading) {
        act(() => leadingControl?.click());
        expect(leading).toHaveBeenCalledOnce();
      } else expect(leadingControl).toBeNull();
      if (hasActions) {
        act(() => actionControl?.click());
        expect(action).toHaveBeenCalledOnce();
      } else expect(actionControl).toBeNull();
      expect(document.body.querySelector('[aria-label="Close dialog"]') !== null).toBe(
        isCloseButtonVisible,
      );
      expect(change).not.toHaveBeenCalled();
    },
  );

  afterEach(() => {
    act(() => {
      root.unmount();
    });

    if (getAnimationsDescriptor === undefined) {
      Reflect.deleteProperty(Element.prototype, 'getAnimations');
    } else {
      Object.defineProperty(Element.prototype, 'getAnimations', getAnimationsDescriptor);
    }

    container.remove();
    vi.clearAllMocks();
  });

  test('keeps the dialog open when the overlay is clicked by default', async () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(<TestDialog onOpenChange={handleOpenChange} />);
    });

    await act(async () => {
      await waitForOutsideInteractionListeners();
    });

    act(() => {
      clickDialogOverlay();
    });

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  test('closes the dialog when overlay closing is enabled', async () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <TestDialog
          isOverlayCloseEnabled
          onOpenChange={handleOpenChange}
        />,
      );
    });

    await act(async () => {
      await waitForOutsideInteractionListeners();
    });

    act(() => {
      clickDialogOverlay();
    });

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  test('closes the topmost nested dialog from its own enabled overlay', async () => {
    const handleNestedOpenChange = vi.fn<(open: boolean) => void>();
    const handleParentOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <NestedOverlayDialog
          onNestedOpenChange={handleNestedOpenChange}
          onParentOpenChange={handleParentOpenChange}
        />,
      );
    });

    await act(async () => {
      await waitForOutsideInteractionListeners();
    });

    const overlays = document.body.querySelectorAll<HTMLElement>('[data-slot="dialog-overlay"]');

    expect(overlays).toHaveLength(2);

    act(() => {
      clickDialogOverlay(overlays.item(1));
    });

    expect(handleNestedOpenChange).toHaveBeenCalledTimes(1);
    expect(handleNestedOpenChange).toHaveBeenCalledWith(false);
    expect(handleParentOpenChange).not.toHaveBeenCalled();
  });

  test('renders a backdrop behind a nested dialog even when overlay dismissal is disabled', async () => {
    const handleNestedOpenChange = vi.fn<(open: boolean) => void>();
    const handleParentOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <NestedOverlayDialog
          isNestedOverlayCloseEnabled={false}
          onNestedOpenChange={handleNestedOpenChange}
          onParentOpenChange={handleParentOpenChange}
        />,
      );
    });

    const modalLayers = document.body.querySelectorAll(
      '[data-slot="dialog-overlay"], [data-slot="dialog-content"]',
    );

    expect([...modalLayers].map((layer) => layer.getAttribute('data-slot'))).toStrictEqual([
      'dialog-overlay',
      'dialog-content',
      'dialog-overlay',
      'dialog-content',
    ]);

    await act(async () => {
      await waitForOutsideInteractionListeners();
    });

    act(() => {
      clickDialogOverlay(modalLayers.item(2) as HTMLElement);
    });

    expect(handleNestedOpenChange).not.toHaveBeenCalled();
    expect(handleParentOpenChange).not.toHaveBeenCalled();
  });

  test('preserves the last open children only until a controlled close transition completes', async () => {
    const handleOpenChangeComplete = vi.fn<(open: boolean) => void>();
    let completeAnimation: (() => void) | undefined;
    const animationFinished = new Promise<void>((resolve) => {
      completeAnimation = resolve;
    });

    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [{ finished: animationFinished }],
    });

    act(() => {
      root.render(<SessionDialog onOpenChangeComplete={handleOpenChangeComplete} />);
    });

    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]',
    );

    act(() => closeButton?.click());

    const dialogContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');

    expect(dialogContent?.dataset['state']).toBe('closed');
    expect(dialogContent?.textContent).toContain('Active session');
    expect(dialogContent?.textContent).toContain('Session content remains stable during close.');
    expect(dialogContent?.className).toContain('motion-reduce:max-sm:data-open:animate-none');
    expect(dialogContent?.className).toContain('motion-reduce:max-sm:data-closed:animate-none');
    expect(dialogContent?.className).toContain('motion-reduce:sm:data-open:animate-none');
    expect(dialogContent?.className).toContain('motion-reduce:sm:data-closed:animate-none');
    expect(getDialogOverlay().className).toContain('motion-reduce:animate-none');
    expect(getDialogOverlay().className).toContain('motion-reduce:data-open:animate-none');
    expect(getDialogOverlay().className).toContain('motion-reduce:data-closed:animate-none');

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
      completeAnimation?.();
      await animationFinished;
    });

    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(handleOpenChangeComplete).toHaveBeenCalledWith(false);
  });

  test('keeps controlled children current while the dialog starts closed', async () => {
    await act(async () => {
      await Promise.resolve();
      root.render(<InitiallyClosedDialog />);
    });

    expect(container.querySelector('[data-slot="closed-dialog-status"]')?.textContent).toBe(
      'Ready',
    );
  });

  test('retains payload-function children and refreshes them when the dialog reopens', () => {
    act(() => {
      root.render(<PayloadChildrenDialog />);
    });

    const getControl = (label: string): HTMLButtonElement | undefined =>
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => button.textContent === label,
      );

    act(() => getControl('Update session')?.click());

    expect(document.body.querySelector('[data-slot="dialog-content"]')?.textContent).toContain(
      'Latest session',
    );

    act(() => getControl('Close from parent')?.click());

    const closedDialogContent = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]',
    );

    expect(closedDialogContent?.dataset['state']).toBe('closed');
    expect(closedDialogContent?.textContent).toContain('Latest session');

    act(() => getControl('Reopen session')?.click());

    const reopenedDialogContent = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-content"]',
    );

    expect(reopenedDialogContent?.dataset['state']).toBe('open');
    expect(reopenedDialogContent?.textContent).toContain('Reopened session');
    expect(reopenedDialogContent?.textContent).not.toContain('Latest session');
  });

  test('renders medium dialogs as centralized page-like surfaces with fixed action regions', async () => {
    await act(async () => {
      await Promise.resolve();
      root.render(
        <Dialog open>
          <DialogContent
            initialFocus="dismiss-control"
            size="medium"
          >
            <DialogHeader actions={<Button type="button">More options</Button>}>
              <DialogTitle>Edit profile</DialogTitle>
              <DialogDescription>Update profile details.</DialogDescription>
            </DialogHeader>
            <DialogBody>Profile fields</DialogBody>
            <DialogFooter>
              <DialogCancel asChild>
                <Button type="button">Cancel</Button>
              </DialogCancel>
              <Button type="button">Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
    });

    const dialogContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const dialogBody = document.body.querySelector<HTMLElement>('[data-slot="dialog-body"]');
    const dialogFooter = document.body.querySelector<HTMLElement>('[data-slot="dialog-footer"]');
    const dialogHeader = document.body.querySelector<HTMLElement>('[data-slot="dialog-header"]');
    const cancelButton = document.body.querySelector<HTMLElement>('[data-slot="dialog-cancel"]');
    const dialogHeaderRow = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-header-row"]',
    );
    const dialogHeaderSupporting = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-header-supporting"]',
    );
    const dialogTitle = document.body.querySelector<HTMLElement>('[data-slot="dialog-title"]');
    const dialogDescription = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-description"]',
    );
    const backButton = document.body.querySelector<HTMLElement>('[data-slot="dialog-back"]');
    const headerAction = Array.from(dialogHeaderRow?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'More options',
    );
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]',
    );

    expect(dialogContent?.dataset['size']).toBe('medium');
    expect(dialogContent?.className).toContain('inset-0');
    expect(dialogContent?.className).toContain('h-dvh');
    expect(dialogContent?.className).toContain('max-sm:data-open:zoom-in-96');
    expect(dialogContent?.className).not.toContain('max-sm:data-closed:fade-out-0');
    expect(dialogContent?.className).not.toContain('max-sm:data-open:slide-in-from-bottom-1');
    expect(dialogContent?.className).not.toContain('max-sm:data-closed:slide-out-to-bottom-1');
    expect(dialogContent?.className).toContain('max-sm:data-open:duration-300');
    expect(dialogContent?.className).not.toContain('max-sm:data-closed:animate-out');
    expect(dialogContent?.className).toContain('motion-reduce:max-sm:data-open:animate-none');
    expect(dialogContent?.className).toContain('sm:data-open:animate-in');
    expect(dialogContent?.className.split(' ')).not.toContain('data-open:animate-in');
    expect(getDialogOverlay().className).toContain('max-sm:hidden');
    expect(dialogContent?.className).toContain('sm:max-w-2xl');
    expect(dialogBody?.className).toContain('content-start');
    expect(dialogBody?.className).toContain('overflow-y-auto');
    expect(dialogFooter?.className).toContain('shrink-0');
    expect(dialogFooter?.className).toContain('flex-col-reverse');
    expect(dialogFooter?.className).toContain('sm:justify-end');
    expect(dialogFooter?.className).toContain('sm:[&>*:first-child:not(:only-child)]:mr-auto');
    expect(
      Array.from(dialogFooter?.children ?? []).map((child) => child.textContent),
    ).toStrictEqual(['Cancel', 'Save']);
    expect(dialogHeader?.className).toContain('gap-0');
    expect(cancelButton?.className).toContain('hidden');
    expect(cancelButton?.className).toContain('sm:inline-flex');
    expect(dialogHeaderRow?.className).toContain('min-h-9');
    expect(dialogHeaderRow?.className).not.toContain('min-h-11');
    expect(backButton?.className).toContain('size-9');
    expect(backButton?.className).not.toContain('size-11');
    expect(dialogHeaderRow?.contains(backButton ?? null)).toBe(true);
    expect(dialogHeaderRow?.contains(dialogTitle ?? null)).toBe(true);
    expect(dialogHeaderRow?.contains(headerAction ?? null)).toBe(true);
    expect(dialogHeaderRow?.contains(dialogDescription ?? null)).toBe(false);
    expect(dialogHeaderSupporting?.contains(dialogDescription ?? null)).toBe(true);
    await vi.waitFor(() => expect(document.activeElement).toBe(closeButton));
  });

  test('replaces generated dismissal icons without changing their accessible close behavior', () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <Dialog
          open
          onOpenChange={handleOpenChange}
        >
          <DialogContent
            backButtonIcon={<span data-icon="custom-back">Previous</span>}
            closeButtonIcon={<span data-icon="custom-close">Dismiss</span>}
            size="large"
          >
            <DialogHeader>
              <DialogTitle>Custom dismissal icons</DialogTitle>
            </DialogHeader>
            <DialogBody>Dialog body</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    const backButton = document.body.querySelector<HTMLButtonElement>('[data-slot="dialog-back"]');
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]',
    );
    const customBackIcon = backButton?.querySelector('[data-icon="custom-back"]');
    const customCloseIcon = closeButton?.querySelector('[data-icon="custom-close"]');

    expect(customBackIcon?.parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(customCloseIcon?.parentElement?.getAttribute('aria-hidden')).toBe('true');

    act(() => closeButton?.click());
    act(() => backButton?.click());

    expect(handleOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(handleOpenChange).toHaveBeenNthCalledWith(2, false);
  });

  test.each(['small', 'medium', 'large'] as const)(
    'renders a non-dismissing caller-owned leading action in a %s dialog',
    (size) => {
      const handleLeadingAction = vi.fn<() => void>();
      const handleOpenChange = vi.fn<(open: boolean) => void>();

      act(() => {
        root.render(
          <Dialog
            open
            onOpenChange={handleOpenChange}
          >
            <DialogContent size={size}>
              <DialogHeader
                leadingAction={
                  <Button
                    aria-label="Return to category"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                    onClick={handleLeadingAction}
                  >
                    Back
                  </Button>
                }
                layout={size === 'small' ? 'split' : 'centered'}
              >
                <DialogTitle>Section details</DialogTitle>
              </DialogHeader>
              <DialogBody>Dialog body</DialogBody>
            </DialogContent>
          </Dialog>,
        );
      });

      const leadingAction = document.body.querySelector<HTMLButtonElement>(
        '[aria-label="Return to category"]',
      );

      expect(
        document.body.querySelector('[data-slot="dialog-header-leading"]')?.contains(leadingAction),
      ).toBe(true);
      expect(document.body.querySelector('[data-slot="dialog-back"]')).toBeNull();

      act(() => leadingAction?.click());

      expect(handleLeadingAction).toHaveBeenCalledOnce();
      expect(handleOpenChange).not.toHaveBeenCalled();
    },
  );

  test('allows a caller-owned leading action to opt into dialog dismissal', () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <Dialog
          open
          onOpenChange={handleOpenChange}
        >
          <DialogContent size="medium">
            <DialogHeader
              leadingAction={
                <DialogClose asChild>
                  <Button
                    aria-label="Dismiss from leading action"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    Close
                  </Button>
                </DialogClose>
              }
            >
              <DialogTitle>Dismissible leading action</DialogTitle>
            </DialogHeader>
            <DialogBody>Dialog body</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[aria-label="Dismiss from leading action"]')
        ?.click();
    });

    expect(handleOpenChange).toHaveBeenCalledOnce();
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });

  test.each([
    ['small', 'max-w-80', false],
    ['large', 'sm:max-w-5xl', true],
  ] as const)(
    'renders the %s size with centralized geometry',
    (size, expectedWidthClassName, hasMobileBackControl) => {
      act(() => {
        root.render(
          <Dialog open>
            <DialogContent size={size}>
              <DialogHeader>
                <DialogTitle>{size} dialog</DialogTitle>
              </DialogHeader>
              <DialogBody>Dialog body</DialogBody>
            </DialogContent>
          </Dialog>,
        );
      });

      const dialogContent = document.body.querySelector<HTMLElement>(
        '[data-slot="dialog-content"]',
      );
      const backButton = dialogContent?.querySelector('[data-slot="dialog-back"]');
      const closeButton = dialogContent?.querySelector<HTMLButtonElement>(
        '[aria-label="Close dialog"]',
      );
      const dialogHeading = dialogContent?.querySelector<HTMLElement>(
        '[data-slot="dialog-heading"]',
      );

      expect(dialogContent?.className).toContain(expectedWidthClassName);
      if (size === 'small') {
        expect(dialogContent?.className).toContain('inset-0');
        expect(dialogContent?.className).toContain('m-auto');
        expect(dialogContent?.className).toContain('h-fit');
        expect(dialogContent?.className).not.toContain('-translate-x-1/2');
        expect(dialogContent?.className).not.toContain('-translate-y-1/2');
        expect(dialogContent?.className).toContain('data-open:slide-in-from-bottom-2');
        expect(dialogContent?.className).toContain('data-closed:slide-out-to-bottom-2');
        expect(dialogContent?.className).toContain('data-open:zoom-in-95');
        expect(dialogContent?.className).toContain('data-closed:zoom-out-95');
        expect(getDialogOverlay().className).not.toContain('max-sm:hidden');
        expect(closeButton?.className).toContain('size-7');
        expect(closeButton?.className).not.toContain('size-11');
        expect(closeButton?.className).toContain('absolute');
        expect(closeButton?.className).toContain('top-2');
        expect(closeButton?.className).toContain('right-2');
        expect(closeButton?.className).toContain('after:-inset-2');
        expect(closeButton?.className).toContain('pointer-coarse:min-h-11');
        expect(closeButton?.className).toContain('pointer-coarse:min-w-11');
        expect(dialogHeading?.className).toContain('[&>[data-slot=dialog-title]]:px-8');
      } else {
        expect(dialogContent?.className).toContain('sm:m-auto');
        expect(dialogContent?.className).toContain('sm:h-fit');
        expect(dialogContent?.className).not.toContain('sm:-translate-x-1/2');
        expect(dialogContent?.className).not.toContain('sm:-translate-y-1/2');
        expect(dialogContent?.className).toContain('max-sm:data-open:zoom-in-96');
        expect(dialogContent?.className).not.toContain('max-sm:data-closed:fade-out-0');
        expect(dialogContent?.className).not.toContain('max-sm:data-open:slide-in-from-bottom-1');
        expect(dialogContent?.className).not.toContain('max-sm:data-closed:slide-out-to-bottom-1');
        expect(dialogContent?.className).toContain('max-sm:data-open:duration-300');
        expect(dialogContent?.className).not.toContain('max-sm:data-closed:animate-out');
        expect(dialogContent?.className).toContain('sm:data-open:animate-in');
        expect(getDialogOverlay().className).toContain('max-sm:hidden');
      }
      expect(backButton instanceof HTMLButtonElement).toBe(hasMobileBackControl);
    },
  );

  test('renders a split small header with left-aligned copy and grouped utility actions', () => {
    act(() => {
      root.render(
        <Dialog open>
          <DialogContent size="small">
            <DialogHeader
              actions={
                <Button
                  aria-label="Restart recording"
                  size="icon-touch"
                  type="button"
                  variant="ghost"
                >
                  Restart
                </Button>
              }
              layout="split"
            >
              <DialogTitle>Audio</DialogTitle>
              <DialogDescription>Record and transcribe audio.</DialogDescription>
            </DialogHeader>
            <DialogBody>Recorder</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    const dialogHeader = document.body.querySelector<HTMLElement>('[data-slot="dialog-header"]');
    const dialogHeaderActions = document.body.querySelector<HTMLElement>(
      '[data-slot="dialog-header-actions"]',
    );
    const dialogHeading = document.body.querySelector<HTMLElement>('[data-slot="dialog-heading"]');
    const restartButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Restart recording"]',
    );
    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]',
    );

    expect(dialogHeader?.className).toContain('text-left');
    expect(dialogHeader?.className).toContain('items-center');
    expect(dialogHeader?.className.split(' ')).not.toContain('text-center');
    expect(dialogHeaderActions?.className).toContain('justify-end');
    expect(dialogHeaderActions?.contains(restartButton ?? null)).toBe(true);
    expect(dialogHeaderActions?.contains(closeButton ?? null)).toBe(true);
    expect(restartButton?.className).toContain('size-11');
    expect(restartButton?.className).toContain('sm:pointer-fine:size-8');
    expect(closeButton?.className).toContain('size-11');
    expect(closeButton?.className).toContain('sm:pointer-fine:size-8');
    expect(closeButton?.className).toContain('pointer-coarse:min-h-11');
    expect(closeButton?.className).toContain('pointer-coarse:min-w-11');
    expect(closeButton?.className).not.toContain('absolute');
    expect(dialogHeading?.className).not.toContain('[&>[data-slot=dialog-title]]:pr-8');
    expect(dialogHeader?.className).toContain('pr-5');
    expect(dialogHeader?.className).not.toContain('pr-16');
    expect(dialogHeader?.className).not.toContain('pr-15');
  });

  test('omits footer cancellation when a small dialog header owns dismissal', () => {
    act(() => {
      root.render(
        <Dialog open>
          <DialogContent size="small">
            <DialogHeader>
              <DialogTitle>Download database backup?</DialogTitle>
            </DialogHeader>
            <DialogBody>Verification code</DialogBody>
            <DialogFooter>
              <DialogCancel>Cancel</DialogCancel>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
    });

    expect(document.body.querySelector('[aria-label="Close dialog"]')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(document.body.querySelector('[data-slot="dialog-header"]')?.className).toContain('pr-5');
    expect(document.body.querySelector('[data-slot="dialog-header"]')?.className).not.toContain(
      'pr-15',
    );
    expect(document.body.querySelector('[data-slot="dialog-heading"]')?.className).toContain(
      '[&>[data-slot=dialog-title]]:px-8',
    );
    expect(document.body.querySelector('[data-slot="dialog-cancel"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Cancel');
  });

  test('allows a caller-owned small header control to replace the generated close icon', () => {
    act(() => {
      root.render(
        <Dialog open>
          <DialogContent
            isCloseButtonVisible={false}
            size="small"
          >
            <DialogHeader>
              <DialogTitle>Custom dismissal</DialogTitle>
            </DialogHeader>
            <DialogBody>Dialog body</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    expect(document.body.querySelector('[aria-label="Close dialog"]')).toBeNull();
    expect(document.body.querySelector('[data-slot="dialog-header"]')?.className).toContain('pr-5');
    expect(document.body.querySelector('[data-slot="dialog-header"]')?.className).not.toContain(
      'pr-15',
    );
    expect(document.body.querySelector('[data-slot="dialog-heading"]')?.className).not.toContain(
      '[&>[data-slot=dialog-title]]:px-8',
    );
  });

  test('rejects panels that omit the mandatory header or scrolling body regions', () => {
    expect(() => {
      act(() => {
        root.render(
          <Dialog open>
            <DialogContent size="medium">
              <DialogBody>Missing header</DialogBody>
            </DialogContent>
          </Dialog>,
        );
      });
    }).toThrowError(
      'DialogContent requires direct DialogHeader and DialogBody children, with one optional DialogFooter.',
    );
  });

  test('preserves form semantics and generated controls when DialogContent renders asChild', () => {
    act(() => {
      root.render(
        <Dialog open>
          <DialogContent
            asChild
            size="medium"
          >
            <form>
              <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <input aria-label="Display name" />
              </DialogBody>
              <DialogFooter>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>,
      );
    });

    const dialogContent = document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]');
    const dialogFooter = dialogContent?.querySelector<HTMLElement>('[data-slot="dialog-footer"]');

    expect(dialogContent?.tagName).toBe('FORM');
    expect(dialogContent?.querySelector('[aria-label="Display name"]')).toBeInstanceOf(
      HTMLInputElement,
    );
    expect(dialogContent?.querySelector('[data-slot="dialog-header"]')).toBeInstanceOf(HTMLElement);
    expect(dialogContent?.querySelector('[data-slot="dialog-back"]')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(dialogContent?.querySelector('[data-slot="dialog-close"]')).toBeInstanceOf(
      HTMLButtonElement,
    );
    expect(dialogFooter?.className).toContain('sm:justify-end');
    expect(dialogFooter?.className).toContain('sm:[&>*:first-child:not(:only-child)]:mr-auto');
  });

  test('disables every generated dismissal control while the dialog is busy', () => {
    const handleOpenChange = vi.fn<(open: boolean) => void>();

    act(() => {
      root.render(
        <Dialog
          isDismissalDisabled
          open
          onOpenChange={handleOpenChange}
        >
          <DialogContent size="medium">
            <DialogHeader>
              <DialogTitle>Saving profile</DialogTitle>
            </DialogHeader>
            <DialogBody>Pending work</DialogBody>
            <DialogFooter>
              <DialogClose disabled={false}>Close explicitly</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>,
      );
    });

    const closeButton = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Close dialog"]',
    );
    const backButton = document.body.querySelector<HTMLButtonElement>('[data-slot="dialog-back"]');
    const explicitCloseButton = Array.from(
      document.body.querySelectorAll<HTMLButtonElement>('[data-slot="dialog-close"]'),
    ).find((button) => button.textContent === 'Close explicitly');

    expect(closeButton?.disabled).toBe(true);
    expect(backButton?.disabled).toBe(true);
    expect(explicitCloseButton?.disabled).toBe(true);

    act(() => closeButton?.click());

    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  test('treats slotted button triggers as native buttons', () => {
    act(() => {
      root.render(
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button">Open dialog</Button>
          </DialogTrigger>
          <DialogContent size="medium">
            <DialogHeader>
              <DialogTitle>Dialog behavior</DialogTitle>
              <DialogDescription>Shared dialog dismissal behavior.</DialogDescription>
            </DialogHeader>
            <DialogBody>Dialog body</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    const triggerButton = getRenderedTriggerButton(container);

    expect(triggerButton.getAttribute('role')).toBeNull();
    expect(triggerButton.hasAttribute('aria-disabled')).toBe(false);
  });

  test('treats nested slotted alert triggers that render buttons as native buttons', () => {
    act(() => {
      root.render(
        <Dialog>
          <DialogTrigger asChild>
            <Alert
              asChild
              interaction="action"
            >
              <button type="button">
                <AlertTitle>Maintenance starts tonight</AlertTitle>
                <AlertDescription>Open checklist.</AlertDescription>
              </button>
            </Alert>
          </DialogTrigger>
          <DialogContent size="medium">
            <DialogHeader>
              <DialogTitle>Dialog behavior</DialogTitle>
              <DialogDescription>Shared dialog dismissal behavior.</DialogDescription>
            </DialogHeader>
            <DialogBody>Dialog body</DialogBody>
          </DialogContent>
        </Dialog>,
      );
    });

    const triggerButton = getRenderedTriggerButton(container);

    expect(triggerButton.getAttribute('role')).toBeNull();
    expect(triggerButton.hasAttribute('aria-disabled')).toBe(false);
  });
});
