import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import type { alertVariants } from './constants.js';

/** Alert props extend the div contract with shared variants and optional slot rendering.
 * @see Alert
 */
export type IAlertProps = React.ComponentProps<'div'> &
  VariantProps<typeof alertVariants> & {
    asChild?: boolean;
  };

/** Title props use phrasing content so alerts can render inside anchors or buttons.
 * @see Alert
 */
export type IAlertTitleProps = React.ComponentProps<'span'>;

/** Description props use phrasing content so alerts can render inside anchors or buttons.
 * @see Alert
 */
export type IAlertDescriptionProps = React.ComponentProps<'span'>;

/** Action props wrap a short supplementary control in the top-right corner.
 * @see Alert
 */
export type IAlertActionProps = React.ComponentProps<'div'>;
