import type * as React from 'react';
import type { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { VariantProps } from 'class-variance-authority';

import type { IDialogNavigationSessionReader } from '../dialog-navigation/index.js';

import type { dialogContentVariants } from './constants.js';

// dialog sizes determine compact or page-like responsive surface behavior.
/** Compact, medium, or large dialog geometry.
 * @see dialog
 */
export type IDialogSize = NonNullable<VariantProps<typeof dialogContentVariants>['size']>;

// dialog props expose Base UI primitives with shared dismissal and layout behavior.
/** Options and native attributes for Dialog.
 * @see dialog
 */
export type IDialogProps = Omit<
  BaseDialog.Root.Props,
  'disablePointerDismissal' | 'onOpenChange'
> & {
  // blocks on-page dismissal; committed navigation still cancels an obsolete dialog.
  isDismissalDisabled?: boolean;
  // allows read-only dialogs to close from overlay clicks when no user effort can be lost.
  isOverlayCloseEnabled?: boolean;
  // synchronous session identity protects replacements before their next React commit
  getNavigationSession?: IDialogNavigationSessionReader;
  onOpenChange?: (open: boolean) => void;
};
/** Options and native attributes for DialogTrigger.
 * @see dialog
 */
export type IDialogTriggerProps = Omit<BaseDialog.Trigger.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};
/** Options and native attributes for DialogClose.
 * @see dialog
 */
export type IDialogCloseProps = Omit<BaseDialog.Close.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};
// footer cancellation is omitted in small dialogs because their generated header close owns dismissal.
/** Options and native attributes for DialogCancel.
 * @see dialog
 */
export type IDialogCancelProps = Omit<IDialogCloseProps, 'className' | 'style'>;
/** Options and native attributes for DialogOverlay.
 * @see dialog
 */
export type IDialogOverlayProps = BaseDialog.Backdrop.Props;
/** Options and native attributes for DialogContent.
 * @see dialog
 */
export type IDialogContentProps = Omit<
  BaseDialog.Popup.Props,
  'className' | 'initialFocus' | 'render' | 'style'
> & {
  // customizes the generated mobile back control without changing its dismissal behavior.
  backButtonIcon?: React.ReactNode;
  // customizes the accessible labels for the generated desktop close and mobile back controls.
  backButtonAriaLabel?: string;
  // customizes the generated desktop close control without changing its dismissal behavior.
  closeButtonIcon?: React.ReactNode;
  closeButtonAriaLabel?: string;
  // hides the generated close icon when a caller-owned header control replaces it.
  isCloseButtonVisible?: boolean;
  asChild?: boolean;
  forceMount?: BaseDialog.Portal.Props['keepMounted'];
  // defaults to the first usable body/footer control; callers may override it or target dismissal.
  initialFocus?: BaseDialog.Popup.Props['initialFocus'] | 'dismiss-control';
  size: IDialogSize;
};
/** Options and native attributes for DialogHeader.
 * @see dialog
 */
export type IDialogHeaderProps = Omit<React.ComponentProps<'header'>, 'className' | 'style'> & {
  actions?: React.ReactNode;
  // renders caller-owned navigation or utility content before the heading.
  leadingAction?: React.ReactNode;
  // split layout aligns compact headings left and groups utilities with the generated close action.
  layout?: 'centered' | 'split';
};
/** Options and native attributes for DialogBody.
 * @see dialog
 */
export type IDialogBodyProps = Omit<React.ComponentProps<'div'>, 'style'> & {
  padding?: 'default' | 'none';
};
/** Options and native attributes for DialogFooter.
 * @see dialog
 */
export type IDialogFooterProps = Omit<React.ComponentProps<'footer'>, 'className' | 'style'>;
/** Options and native attributes for DialogTitle.
 * @see dialog
 */
export type IDialogTitleProps = BaseDialog.Title.Props;
/** Options and native attributes for DialogDescription.
 * @see dialog
 */
export type IDialogDescriptionProps = BaseDialog.Description.Props;
