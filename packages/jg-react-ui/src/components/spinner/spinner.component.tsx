import type * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from 'cnfast';

import type { ISpinnerProps } from './types.js';

/**
 * Renders an accessible loading spinner using the shared icon size and animation.
 * @param props The spinner icon props and optional accessibility overrides.
 * @returns A React element that renders the spinner.
 * @example
 * import { createElement } from 'react';
 * import { Spinner } from 'jg-react-ui/components/spinner';
 * const example = createElement(Spinner, { 'aria-label': 'Loading records' });
 */
export const Spinner = ({
  className,
  role = 'status',
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
  ...props
}: ISpinnerProps): React.ReactElement => (
  <LoaderCircle
    data-slot="spinner"
    className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
    role={ariaHidden ? undefined : role}
    aria-hidden={ariaHidden}
    aria-label={ariaHidden ? undefined : (ariaLabel ?? 'Loading')}
    {...props}
  />
);
