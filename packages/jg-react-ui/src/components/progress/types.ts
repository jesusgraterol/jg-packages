import type * as React from 'react';
import type { Progress as BaseProgress } from '@base-ui/react/progress';

// wrapper-owned indicator props keep the public API focused on shared progress behavior.
type IProgressBaseProps = Omit<
  React.ComponentProps<typeof BaseProgress.Root>,
  'children' | 'value'
> & {
  indicatorClassName?: string;
};

/** Determinate progress requires a concrete numeric value.
 * @see Progress
 */
export type IProgressDeterminateProps = IProgressBaseProps & {
  value: number;
  indeterminate?: false;
};

/** Indeterminate progress omits value so the two modes cannot be combined.
 * @see Progress
 */
export type IProgressIndeterminateProps = IProgressBaseProps & {
  indeterminate: true;
  value?: never;
};

/** Exported progress props keep determinate and indeterminate usage mutually exclusive.
 * @see Progress
 */
export type IProgressProps = IProgressDeterminateProps | IProgressIndeterminateProps;
