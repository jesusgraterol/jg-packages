import type * as React from 'react';
import { cn } from 'cnfast';

import { useSlottedRender } from '../../shared/slotted-render/index.js';
import { badgeVariants } from './constants.js';
import type { IBadgeProps } from './types.js';

/**
 * Renders a compact status or metadata label using the shared badge variants.
 * @param props The badge element props, visual variant, and optional slot rendering flag.
 * @returns A React element that renders the badge as a span or passes styling to its child.
 * @example
 * import { createElement } from 'react';
 * import { Badge } from 'jg-react-ui/components/badge';
 * const example = createElement(Badge, null, 'Example');
 * @throws
 * - asChild requires exactly one valid React element child.
 */
export const Badge = ({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: IBadgeProps): React.ReactElement => {
  return useSlottedRender<'span', HTMLSpanElement>({
    asChild,
    defaultTagName: 'span',
    baseProps: {
      'data-slot': 'badge',
      'data-variant': variant,
      className: cn(badgeVariants({ variant, className })),
    } as React.ComponentPropsWithRef<'span'>,
    elementProps: props,
  });
};
