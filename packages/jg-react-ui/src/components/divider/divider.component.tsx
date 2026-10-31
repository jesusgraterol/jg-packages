import type * as React from 'react';
import { Separator as BaseSeparator } from '@base-ui/react/separator';
import { cn } from 'cnfast';

import type { IDividerProps } from './types.js';

/**
 * Renders a horizontal or vertical separator with the shared border token.
 * @param props The Base UI separator props and optional orientation.
 * @returns A React element that renders the divider.
 * @example
 * import { createElement } from 'react';
 * import { Divider } from 'jg-react-ui/components/divider';
 * const example = createElement(Divider, { decorative: false, 'aria-label': 'Section boundary' });
 */
export const Divider = ({
  className,
  orientation = 'horizontal',
  decorative = true,
  role,
  'aria-orientation': ariaOrientation,
  ...props
}: IDividerProps): React.ReactElement => (
  <BaseSeparator
    data-slot="divider"
    orientation={orientation}
    role={decorative ? 'presentation' : (role ?? 'separator')}
    aria-orientation={decorative ? undefined : (ariaOrientation ?? orientation)}
    className={cn(
      'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
      className,
    )}
    {...props}
  />
);
