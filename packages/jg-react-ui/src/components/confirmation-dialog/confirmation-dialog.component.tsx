import { useCallback } from 'react';
import type * as React from 'react';

import { ConfirmationDialogView } from './confirmation-dialog-view.component.js';
import { useConfirmationDialogStore } from './store.js';

/** Reads the current session synchronously so replaced sessions survive navigation cleanup. */
const getNavigationSession = (): object | null => {
  const session = useConfirmationDialogStore.getState();

  return session.isConfirmationDialogOpen ? session : null;
};

/**
 * Renders the root-mounted confirmation dialog shell and lets the dialog primitive manage portal presence.
 * @returns A React element for the shared confirmation dialog root.
 * @example
 * import { createElement } from 'react';
 * import { ConfirmationDialog } from 'jg-react-ui/components/confirmation-dialog';
 * const example = createElement(ConfirmationDialog, {});
 */
export const ConfirmationDialog = (): React.ReactElement | null => {
  const isConfirmationDialogOpen = useConfirmationDialogStore(
    (state) => state.isConfirmationDialogOpen,
  );
  const title = useConfirmationDialogStore((state) => state.title);
  const description = useConfirmationDialogStore((state) => state.description);
  const confirmText = useConfirmationDialogStore((state) => state.confirmText);
  const destructive = useConfirmationDialogStore((state) => state.destructive);
  const closeConfirmationDialog = useConfirmationDialogStore(
    (state) => state.closeConfirmationDialog,
  );

  /**
   * Completes the confirmation dialog with cancellation when the dialog primitive closes.
   * @param nextOpen Whether the dialog should remain open.
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        closeConfirmationDialog(undefined);
      }
    },
    [closeConfirmationDialog],
  );

  /**
   * Completes the confirmation dialog with an explicit confirm decision.
   */
  const handleConfirm = useCallback((): void => {
    closeConfirmationDialog(true);
  }, [closeConfirmationDialog]);

  return (
    <ConfirmationDialogView
      getNavigationSession={getNavigationSession}
      open={isConfirmationDialogOpen}
      title={title}
      description={description}
      confirmText={confirmText}
      destructive={destructive}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
    />
  );
};
