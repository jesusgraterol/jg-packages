import type * as React from 'react';
import type { VariantProps } from 'class-variance-authority';

import type { badgeVariants } from './constants.js';

/** Badge props extend the span contract with shared variants and optional slot rendering.
 * @see Badge
 */
export type IBadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };
