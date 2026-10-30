import type * as React from 'react';
import type { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import type { VariantProps } from 'class-variance-authority';

import type { IDialogNavigationSessionReader } from '../dialog-navigation/index.js';
import type { buttonVariants } from '../button/index.js';

// alert dialog props expose Base UI primitives with shared content and button variants.
/** Options and native attributes for AlertDialog.
 * @see alert-dialog
 */
export type IAlertDialogProps = Omit<BaseAlertDialog.Root.Props, 'onOpenChange'> & {
  // synchronous session identity protects replacements before their next React commit
  getNavigationSession?: IDialogNavigationSessionReader;
  onOpenChange?: (open: boolean) => void;
};
/** Options and native attributes for AlertDialogTrigger.
 * @see alert-dialog
 */
export type IAlertDialogTriggerProps = Omit<
  BaseAlertDialog.Trigger.Props,
  'nativeButton' | 'render'
> & {
  asChild?: boolean;
};
/** Options and native attributes for AlertDialogOverlay.
 * @see alert-dialog
 */
export type IAlertDialogOverlayProps = BaseAlertDialog.Backdrop.Props;
/** Options and native attributes for AlertDialogContent.
 * @see alert-dialog
 */
export type IAlertDialogContentProps = Omit<
  BaseAlertDialog.Popup.Props,
  'className' | 'render' | 'style'
>;
/** Options and native attributes for AlertDialogHeader.
 * @see alert-dialog
 */
export type IAlertDialogHeaderProps = Omit<React.ComponentProps<'header'>, 'className' | 'style'>;
/** Options and native attributes for AlertDialogFooter.
 * @see alert-dialog
 */
export type IAlertDialogFooterProps = Omit<React.ComponentProps<'footer'>, 'className' | 'style'>;
/** Options and native attributes for AlertDialogTitle.
 * @see alert-dialog
 */
export type IAlertDialogTitleProps = BaseAlertDialog.Title.Props;
/** Options and native attributes for AlertDialogDescription.
 * @see alert-dialog
 */
export type IAlertDialogDescriptionProps = BaseAlertDialog.Description.Props;
/** Options and native attributes for AlertDialogAction.
 * @see alert-dialog
 */
export type IAlertDialogActionProps = Omit<BaseAlertDialog.Close.Props, 'nativeButton' | 'render'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };
