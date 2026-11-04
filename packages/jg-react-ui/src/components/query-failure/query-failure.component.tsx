import type * as React from 'react';
import { cn } from 'cnfast';
import { useOnlineStatus } from 'jg-react';

import { Illustration } from '../illustration/index.js';
import { QueryErrorAlert } from '../query-error-alert/index.js';

import { QUERY_FAILURE_OFFLINE_MESSAGE } from './constants.js';
import type { IQueryFailureProps } from './types.js';

/**
 * Renders a read that failed before its screen had anything to show with an illustration, of
 * being offline when the browser says so, with a note, and of a failure otherwise, above the
 * alert that retries it. A failure that leaves data on screen shows the alert alone. Pass it as a
 * QueryBoundary's `renderErrorAlert`.
 * @param props What QueryBoundary hands its error alert, and the offline note.
 * @returns A React element that renders the failure.
 * @example
 * import { createElement } from 'react';
 * import { QueryFailure } from 'jg-react-ui/components/query-failure';
 * const example = createElement(QueryFailure, {
 *   presentation: 'blocking',
 *   queries: [{ isError: true, error: new Error('Offline'), refetch: async () => undefined }],
 * });
 */
export const QueryFailure = ({
  offlineMessage = QUERY_FAILURE_OFFLINE_MESSAGE,
  className,
  ...props
}: IQueryFailureProps): React.ReactElement => {
  const isOnline = useOnlineStatus();
  const hasFailed = props.queries.some((query) => query.isError);
  if (!hasFailed || props.presentation !== 'blocking') {
    return (
      <QueryErrorAlert
        {...props}
        className={className}
      />
    );
  }
  return (
    <div
      data-slot="query-failure"
      className="flex flex-col items-center gap-4 py-6 text-center"
    >
      <Illustration name={isOnline ? 'error' : 'offline'} />
      {isOnline ? null : <p className="text-sm font-medium">{offlineMessage}</p>}
      <QueryErrorAlert
        {...props}
        className={cn('w-full text-start', className)}
      />
    </div>
  );
};
