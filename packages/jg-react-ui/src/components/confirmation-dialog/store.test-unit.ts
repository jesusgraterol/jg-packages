import { afterEach, expect, test, vi } from 'vitest';

import { useConfirmationDialogStore } from './index.js';

afterEach(() =>
  useConfirmationDialogStore.setState(useConfirmationDialogStore.getInitialState(), true),
);

test('resets before completion, preserves a reentrant replacement, and completes only once', () => {
  const replacement = vi.fn();
  const completion = vi.fn((isConfirmed: true | undefined) => {
    expect(isConfirmed).toBe(true);
    expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
    useConfirmationDialogStore
      .getState()
      .openConfirmationDialog({ title: 'Next session', onConfirmationDialogClose: replacement });
  });
  useConfirmationDialogStore
    .getState()
    .openConfirmationDialog({ destructive: true, onConfirmationDialogClose: completion });
  expect(useConfirmationDialogStore.getState().title).toBe('Delete this item?');
  useConfirmationDialogStore.getState().closeConfirmationDialog(true);
  expect(completion).toHaveBeenCalledExactlyOnceWith(true);
  expect(useConfirmationDialogStore.getState().title).toBe('Next session');
  expect(useConfirmationDialogStore.getState().destructive).toBe(false);
  useConfirmationDialogStore.getState().closeConfirmationDialog(undefined);
  useConfirmationDialogStore.getState().closeConfirmationDialog(true);
  expect(replacement).toHaveBeenCalledExactlyOnceWith(undefined);
});

test('leaves a completed session closed when the application callback throws', () => {
  const error = new Error('Application completion failed');
  useConfirmationDialogStore.getState().openConfirmationDialog({
    onConfirmationDialogClose: () => {
      throw error;
    },
  });
  expect(() => useConfirmationDialogStore.getState().closeConfirmationDialog(undefined)).toThrow(
    error,
  );
  expect(useConfirmationDialogStore.getState().isConfirmationDialogOpen).toBe(false);
  expect(useConfirmationDialogStore.getState().onConfirmationDialogClose).toBeUndefined();
});
