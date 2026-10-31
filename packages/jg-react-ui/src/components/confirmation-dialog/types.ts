import type * as React from 'react';

import type { IDialogNavigationSessionReader } from '../dialog-navigation/index.js';

// internal view props represent the fixed root-mounted confirmation dialog surface.
/** Options and native attributes for ConfirmationDialogView.
 * @see confirmation-dialog
 */
export type IConfirmationDialogViewProps = {
  getNavigationSession?: IDialogNavigationSessionReader;
  open: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  destructive?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

// completion callbacks receive true after confirmation or undefined after dismissal.
/** Options and native attributes for ConfirmationDialogCloseHandler.
 * @see confirmation-dialog
 */
export type IConfirmationDialogCloseHandler = (isConfirmed: true | undefined) => unknown;

// open options configure one dialog session while keeping completion handling required.
/** Options and native attributes for OpenConfirmationDialogOptions.
 * @see confirmation-dialog
 */
export type IOpenConfirmationDialogOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  destructive?: boolean;
  onConfirmationDialogClose: IConfirmationDialogCloseHandler;
};

// store-owned dialog state keeps only the currently configurable session fields.
/** Options and native attributes for ConfirmationDialogState.
 * @see confirmation-dialog
 */
export type IConfirmationDialogState = {
  isConfirmationDialogOpen: boolean;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText: React.ReactNode;
  destructive: boolean;
  onConfirmationDialogClose: IConfirmationDialogCloseHandler | undefined;
};

// Zustand store controls the root-mounted confirmation dialog session.
/** Options and native attributes for ConfirmationDialogStore.
 * @see confirmation-dialog
 */
export type IConfirmationDialogStore = IConfirmationDialogState & {
  /**
   * Opens a new confirmation dialog session with optional copy and risk styling.
   * @param options The dialog session options.
   */
  openConfirmationDialog: (options: IOpenConfirmationDialogOptions) => void;

  /**
   * Closes the current dialog session and completes it with a user decision.
   * @param isConfirmed True when the user confirmed, or undefined when dismissed.
   * @throws
   * - The application-owned completion callback's error.
   */
  closeConfirmationDialog: (isConfirmed: true | undefined) => void;
};
