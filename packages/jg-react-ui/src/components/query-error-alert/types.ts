import { type ComponentProps } from 'react';

/** Query error presentations distinguish blocking recovery from retained-content feedback.
 * @see IQueryErrorAlertPresentation
 */
export type IQueryErrorAlertPresentation = 'blocking' | 'retained';

/** Structural query errors accepted from application-owned query clients.
 * @see IQueryErrorAlertQuery
 */
export type IQueryErrorAlertQuery = {
  error: unknown;
  isError: boolean;
  isFetching?: boolean;
  isRefetching?: boolean;
  refetch: () => Promise<unknown>;
};

/** Query error alert props cover copy and failed query retrying.
 * @see IQueryErrorAlertProps
 */
export type IQueryErrorAlertProps = Omit<ComponentProps<'div'>, 'title'> & {
  presentation: IQueryErrorAlertPresentation;
  queries: readonly IQueryErrorAlertQuery[];
  title?: string;
  fallbackMessage?: string;
  retryLabel?: string;
  retryingLabel?: string;
};

/** Query error toastr props provide layout-free recovery for retained application content.
 * @see IQueryErrorToastrProps
 */
export type IQueryErrorToastrProps = Pick<
  IQueryErrorAlertProps,
  'queries' | 'retryLabel' | 'retryingLabel' | 'title' | 'fallbackMessage'
> & {
  toastId: string | number;
};

/** Normalized first-error details displayed by the query error alert.
 * @see IQueryErrorDetails
 */
export type IQueryErrorDetails = {
  code: string | null;
  message: string;
};
