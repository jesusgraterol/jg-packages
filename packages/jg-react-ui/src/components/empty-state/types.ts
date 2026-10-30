import type * as React from 'react';

/** Empty-state slots preserve native attributes while supporting semantic child elements.
 * @see EmptyState
 */
export type IEmptyStateProps = React.ComponentProps<'div'> & {
  asChild?: boolean;
};

/** Native props for IEmptyStateTitleProps, retaining the source component contract.
 * @see EmptyState
 */
export type IEmptyStateTitleProps = React.ComponentProps<'p'> & {
  asChild?: boolean;
};

/** Native props for IEmptyStateDescriptionProps, retaining the source component contract.
 * @see EmptyState
 */
export type IEmptyStateDescriptionProps = React.ComponentProps<'p'> & {
  asChild?: boolean;
};
