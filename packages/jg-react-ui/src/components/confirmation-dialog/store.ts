import { create } from 'zustand';

import {
  DEFAULT_CONFIRMATION_DIALOG_STATE,
  DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE,
} from './constants.js';
import type { IConfirmationDialogStore } from './types.js';

/**
 * Stores the active root-mounted confirmation dialog session and completion callback.
 * @returns The selected confirmation dialog store state.
 * @example
 * import { useConfirmationDialogStore } from 'jg-react-ui/components/confirmation-dialog';
 * useConfirmationDialogStore.getState().openConfirmationDialog({
 *   title: 'Archive project?',
 *   onConfirmationDialogClose: (isConfirmed) => { void isConfirmed; },
 * });
 */
export const useConfirmationDialogStore = create<IConfirmationDialogStore>()((set, get) => ({
  ...DEFAULT_CONFIRMATION_DIALOG_STATE,

  /**
   * Opens a new confirmation dialog session with optional copy and risk styling.
   * @param options The dialog session options.
   */
  openConfirmationDialog: (options): void => {
    const defaults = options.destructive
      ? {
          ...DEFAULT_CONFIRMATION_DIALOG_STATE,
          ...DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE,
        }
      : DEFAULT_CONFIRMATION_DIALOG_STATE;

    set({
      ...defaults,
      ...options,
      isConfirmationDialogOpen: true,
      destructive: options.destructive ?? defaults.destructive,
      onConfirmationDialogClose: options.onConfirmationDialogClose,
    });
  },

  /**
   * Closes the current dialog session and completes it with confirmation or cancellation.
   * @param isConfirmed True when the user confirmed, or undefined when dismissed.
   * @throws
   * - The application-owned completion callback's error.
   */
  closeConfirmationDialog: (isConfirmed): void => {
    const { isConfirmationDialogOpen, onConfirmationDialogClose } = get();

    if (!isConfirmationDialogOpen) {
      return;
    }

    set(DEFAULT_CONFIRMATION_DIALOG_STATE);
    void onConfirmationDialogClose?.(isConfirmed);
  },
}));
