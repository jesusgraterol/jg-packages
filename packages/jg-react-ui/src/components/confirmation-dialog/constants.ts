import type { IConfirmationDialogState } from './types.js';

// default copy for routine confirmation sessions.
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_CONFIRMATION_DIALOG_TITLE
 */
export const DEFAULT_CONFIRMATION_DIALOG_TITLE = 'Confirm action';
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_CONFIRMATION_DIALOG_DESCRIPTION
 */
export const DEFAULT_CONFIRMATION_DIALOG_DESCRIPTION = null;
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_CONFIRMATION_DIALOG_CONFIRM_TEXT
 */
export const DEFAULT_CONFIRMATION_DIALOG_CONFIRM_TEXT = 'Confirm';

// default copy for high-risk confirmation sessions.
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_TITLE
 */
export const DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_TITLE = 'Delete this item?';
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_DESCRIPTION
 */
export const DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_DESCRIPTION = 'This action cannot be undone.';
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_CONFIRM_TEXT
 */
export const DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_CONFIRM_TEXT = 'Delete';

// default store values reset each routine dialog session back to shared confirmation copy.
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_CONFIRMATION_DIALOG_STATE
 */
export const DEFAULT_CONFIRMATION_DIALOG_STATE = {
  isConfirmationDialogOpen: false,
  title: DEFAULT_CONFIRMATION_DIALOG_TITLE,
  description: DEFAULT_CONFIRMATION_DIALOG_DESCRIPTION,
  confirmText: DEFAULT_CONFIRMATION_DIALOG_CONFIRM_TEXT,
  destructive: false,
  onConfirmationDialogClose: undefined,
} satisfies IConfirmationDialogState;

// destructive defaults intentionally differ so risky sessions remain clearly signposted.
/** Shared confirmation-dialog styling contract.
 * @see DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE
 */
export const DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_STATE = {
  title: DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_TITLE,
  description: DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_DESCRIPTION,
  confirmText: DEFAULT_DESTRUCTIVE_CONFIRMATION_DIALOG_CONFIRM_TEXT,
  destructive: true,
} satisfies Pick<IConfirmationDialogState, 'title' | 'description' | 'confirmText' | 'destructive'>;
