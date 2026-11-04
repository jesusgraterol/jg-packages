import type * as React from 'react';

import type { IDialogContentProps, IDialogProps } from '../dialog/index.js';
import type { IDrawerContentProps } from '../drawer/index.js';

/** Dialog widths a ResponsiveDialog offers on wider screens; the sheet spans a phone's width.
 * @see ResponsiveDialog
 */
export type IResponsiveDialogSize = 'small' | 'medium';

/** Options for ResponsiveDialog: its state, its title and body, and where focus goes.
 * @see ResponsiveDialog
 */
export type IResponsiveDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // the visible title, which names the dialog
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  // the dialog's width from the md breakpoint up. Defaults to medium
  size?: IResponsiveDialogSize;
  // where focus goes as the dialog opens on wider screens
  initialFocus?: IDialogContentProps['initialFocus'];
  // where focus goes as the sheet opens on phones, such as nothing that opens the keyboard
  sheetInitialFocus?: IDrawerContentProps['initialFocus'];
  // where focus goes as either closes. Defaults to the control that opened it
  finalFocus?: IDialogContentProps['finalFocus'] & IDrawerContentProps['finalFocus'];
  // lets a click outside close the dialog, as the sheet always allows; for read-only content
  isOverlayCloseEnabled?: boolean;
  // reads the dialog's navigation session, as Dialog does
  getNavigationSession?: IDialogProps['getNavigationSession'];
};
