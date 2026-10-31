import { type ComponentProps, type ReactNode } from 'react';

/** Global error refresh handlers recover through jg-sw's updateApp or docs-specific no-op previews.
 * @see IGlobalErrorBoundaryRefreshHandler
 */
export type IGlobalErrorBoundaryRefreshHandler = () => Promise<void> | void;

/** Global error boundary class overrides target stable presentation slots.
 * @see IGlobalErrorBoundaryClassNames
 */
export type IGlobalErrorBoundaryClassNames = {
  root?: string;
  content?: string;
  status?: string;
  heading?: string;
  description?: string;
  errorMessage?: string;
  errorCode?: string;
  refreshButton?: string;
  refreshError?: string;
};

/** Route-level error boundary props allow copy and styling overrides.
 * @see IGlobalErrorBoundaryProps
 */
export type IGlobalErrorBoundaryProps = Omit<ComponentProps<'main'>, 'children'> & {
  classNames?: IGlobalErrorBoundaryClassNames;
  description?: ReactNode;
  heading?: ReactNode;
  refreshButtonLabel?: ReactNode;
  refreshingButtonLabel?: ReactNode;
  statusLabel?: ReactNode;
  onRefreshClick?: IGlobalErrorBoundaryRefreshHandler;
};

/** Presentational error boundary props accept the error supplied by React Router or tests.
 * @see IGlobalErrorBoundaryViewProps
 */
export type IGlobalErrorBoundaryViewProps = IGlobalErrorBoundaryProps & {
  error: unknown;
};
