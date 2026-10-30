import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import type { buttonVariants } from './constants.js';

/** Places the count badge on one of the button corners.
 * @see IButtonProps
 */
export type IButtonBadgeLocation = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/** Semantic count badge themes.
 * @see IButtonProps
 */
export type IButtonBadgeTheme = 'destructive' | 'outline' | 'primary' | 'secondary';

/** Native button props with visual variants, count badges, and optional child rendering.
 * @see Button
 */
export type IButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    badgeCount?: number;
    badgeLocation?: IButtonBadgeLocation;
    badgeTheme?: IButtonBadgeTheme;
    maxValue?: number;
  };
