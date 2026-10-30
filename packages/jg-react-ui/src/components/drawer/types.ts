import type * as React from 'react';
import type { Drawer as BaseDrawer } from '@base-ui/react/drawer';
import type { VariantProps } from 'class-variance-authority';

import type { drawerHeaderVariants, drawerPopupVariants } from './constants.js';

// drawer placement, width, and density are explicit so consumers preserve coordinated geometry.
/** Left or right edge placement.
 * @see drawer
 */
export type IDrawerSide = NonNullable<VariantProps<typeof drawerPopupVariants>['side']>;
/** Compact or medium drawer width.
 * @see drawer
 */
export type IDrawerSize = NonNullable<VariantProps<typeof drawerPopupVariants>['size']>;
/** Coordinated header and body spacing.
 * @see drawer
 */
export type IDrawerDensity = NonNullable<VariantProps<typeof drawerHeaderVariants>['density']>;

// drawer props own placement and dismissal behavior at the root primitive.
/** Options and native attributes for Drawer.
 * @see drawer
 */
export type IDrawerProps = Omit<
  BaseDrawer.Root.Props,
  'disablePointerDismissal' | 'onOpenChange' | 'swipeDirection'
> & {
  // blocks every user-driven dismissal path while work must remain uninterrupted.
  isDismissalDisabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  side: IDrawerSide;
};
/** Options and native attributes for DrawerTrigger.
 * @see drawer
 */
export type IDrawerTriggerProps = Omit<BaseDrawer.Trigger.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};
/** Options and native attributes for DrawerClose.
 * @see drawer
 */
export type IDrawerCloseProps = Omit<BaseDrawer.Close.Props, 'nativeButton' | 'render'> & {
  asChild?: boolean;
};
/** Options and native attributes for DrawerContent.
 * @see drawer
 */
export type IDrawerContentProps = Omit<BaseDrawer.Popup.Props, 'className' | 'render' | 'style'> & {
  closeButtonAriaLabel?: string;
  closeButtonIcon?: React.ReactNode;
  density?: IDrawerDensity;
  forceMount?: BaseDrawer.Portal.Props['keepMounted'];
  size: IDrawerSize;
  viewportStyle?: React.CSSProperties;
};
/** Options and native attributes for DrawerHeader.
 * @see drawer
 */
export type IDrawerHeaderProps = Omit<React.ComponentProps<'header'>, 'className' | 'style'> & {
  actions?: React.ReactNode;
};
/** Options and native attributes for DrawerBody.
 * @see drawer
 */
export type IDrawerBodyProps = Omit<React.ComponentProps<'div'>, 'style'>;
/** Options and native attributes for DrawerFooter.
 * @see drawer
 */
export type IDrawerFooterProps = Omit<React.ComponentProps<'footer'>, 'style'>;
/** Options and native attributes for DrawerTitle.
 * @see drawer
 */
export type IDrawerTitleProps = BaseDrawer.Title.Props;
/** Options and native attributes for DrawerDescription.
 * @see drawer
 */
export type IDrawerDescriptionProps = BaseDrawer.Description.Props;
