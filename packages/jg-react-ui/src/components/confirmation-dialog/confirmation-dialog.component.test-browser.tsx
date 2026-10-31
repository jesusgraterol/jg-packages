import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ConfirmationDialog, useConfirmationDialogStore } from './index.js';

// React act environment flag suppresses false-positive act warnings in Vitest.
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

/**
 * Returns a confirmation dialog button by its visible text or accessible label.
 * @param label The button label to match.
 * @returns The matching button element.
 */
const getConfirmationDialogButton = (label: string): HTMLButtonElement => {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (currentButton) =>
      currentButton.textContent?.trim() === label ||
      currentButton.getAttribute('aria-label') === label,
  );

  if (button === undefined) {
    throw new Error(`Confirmation dialog button "${label}" was not found.`);
  }

  return button;
};

describe('ConfirmationDialog', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      await Promise.resolve();
      root.unmount();
    });
    container.remove();
    useConfirmationDialogStore.setState({
      ...useConfirmationDialogStore.getInitialState(),
      openConfirmationDialog: useConfirmationDialogStore.getState().openConfirmationDialog,
      closeConfirmationDialog: useConfirmationDialogStore.getState().closeConfirmationDialog,
    });
    vi.clearAllMocks();
  });

  test('opens from the store with routine default copy and controls', async () => {
    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    expect(document.body.textContent).not.toContain('Confirm action');

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        onConfirmationDialogClose: vi.fn(),
      });
    });

    expect(document.body.textContent).toContain('Confirm action');
    expect(document.body.querySelector('[data-slot="alert-dialog-description"]')).toBeNull();
    expect(document.body.textContent).toContain('Confirm');
    expect(document.body.textContent).not.toContain('Cancel');
    const closeButton = getConfirmationDialogButton('Close dialog');
    const confirmButton = getConfirmationDialogButton('Confirm');

    expect(closeButton.className).toContain('size-7');
    expect(closeButton.className).not.toContain('size-11');
    expect(closeButton.className).toContain('absolute');
    expect(closeButton.className).toContain('after:-inset-2');
    expect(confirmButton.className).toContain('min-h-11');
    expect(confirmButton.closest('[data-slot="alert-dialog-footer"]')?.className).toContain(
      '*:w-full',
    );
    expect(document.body.querySelector('[data-slot="icon-tile"]')).toBeNull();
  });

  test('opens from the store and completes with confirmation', async () => {
    const handleConfirmationDialogClose = vi.fn<(isConfirmed: true | undefined) => void>();

    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        title: 'Archive this project?',
        description: 'The project will be hidden from active dashboards.',
        confirmText: 'Archive',
        onConfirmationDialogClose: handleConfirmationDialogClose,
      });
    });

    expect(document.body.textContent).toContain('Archive this project?');
    expect(document.body.textContent).toContain(
      'The project will be hidden from active dashboards.',
    );
    expect(document.body.textContent).toContain('Archive');

    await act(async () => {
      await Promise.resolve();
      getConfirmationDialogButton('Archive').click();
    });

    expect(handleConfirmationDialogClose).toHaveBeenCalledTimes(1);
    expect(handleConfirmationDialogClose).toHaveBeenCalledWith(true);
    expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('Archive this project?'),
    );
  });

  test('opens destructive sessions with destructive defaults and action styling', async () => {
    const handleConfirmationDialogClose = vi.fn<(isConfirmed: true | undefined) => void>();

    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        destructive: true,
        onConfirmationDialogClose: handleConfirmationDialogClose,
      });
    });

    const destructiveAction = getConfirmationDialogButton('Delete');

    expect(document.body.textContent).toContain('Delete this item?');
    expect(document.body.textContent).toContain('This action cannot be undone.');
    expect(document.body.textContent).not.toContain('Cancel');
    expect(getConfirmationDialogButton('Close dialog')).toBeInstanceOf(HTMLButtonElement);
    expect(document.body.querySelector('[data-slot="icon-tile"]')).not.toBeNull();
    expect(destructiveAction.dataset['variant']).toBe('destructive');
  });

  test('closeConfirmationDialog(undefined) -> completes cancellation and resets session copy', async () => {
    const handleConfirmationDialogClose = vi.fn<(isConfirmed: true | undefined) => void>();

    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        title: 'Cancelable confirmation',
        destructive: true,
        onConfirmationDialogClose: handleConfirmationDialogClose,
      });
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().closeConfirmationDialog(undefined);
    });

    expect(handleConfirmationDialogClose).toHaveBeenCalledTimes(1);
    expect(handleConfirmationDialogClose).toHaveBeenCalledWith(undefined);
    expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        onConfirmationDialogClose: vi.fn(),
      });
    });

    expect(document.body.textContent).toContain('Confirm action');
    expect(document.body.textContent).not.toContain('Cancelable confirmation');
    expect(document.body.textContent).not.toContain('Delete this item?');
  });

  test('completes cancellation when the compact header close button is clicked', async () => {
    const handleConfirmationDialogClose = vi.fn<(isConfirmed: true | undefined) => void>();

    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        onConfirmationDialogClose: handleConfirmationDialogClose,
      });
    });

    await act(async () => {
      await Promise.resolve();
      getConfirmationDialogButton('Close dialog').click();
    });

    expect(handleConfirmationDialogClose).toHaveBeenCalledTimes(1);
    expect(handleConfirmationDialogClose).toHaveBeenCalledWith(undefined);
    expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
  });

  test('completes cancellation when Escape is pressed', async () => {
    const handleConfirmationDialogClose = vi.fn<(isConfirmed: true | undefined) => void>();

    await act(async () => {
      await Promise.resolve();
      root.render(<ConfirmationDialog />);
    });

    await act(async () => {
      await Promise.resolve();
      useConfirmationDialogStore.getState().openConfirmationDialog({
        title: 'Keyboard cancellable confirmation',
        onConfirmationDialogClose: handleConfirmationDialogClose,
      });
    });

    await act(async () => {
      await Promise.resolve();
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Escape',
        }),
      );
    });

    expect(handleConfirmationDialogClose).toHaveBeenCalledTimes(1);
    expect(handleConfirmationDialogClose).toHaveBeenCalledWith(undefined);
    expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
    await vi.waitFor(() =>
      expect(document.body.textContent).not.toContain('Keyboard cancellable confirmation'),
    );
  });
});
