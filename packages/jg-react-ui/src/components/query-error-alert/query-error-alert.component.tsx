import { type ReactElement, useCallback, useMemo, useRef, useState } from 'react';
import { RefreshCcw, TriangleAlert } from 'lucide-react';
import { cn } from 'cnfast';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { Alert, AlertDescription, AlertTitle } from '../alert/index.js';
import { Badge } from '../badge/index.js';
import { Button } from '../button/index.js';
import { IconTile } from '../icon-tile/index.js';
import { Spinner } from '../spinner/index.js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../tooltip/index.js';
import type { IQueryErrorAlertProps } from './types.js';
import { getFailedQueries, getQueryErrorDetails, isQueryFetching } from './utilities.js';

/**
 * Renders an alert for failed queries with the first error message, code, and retry action.
 * @param props The failed query results and optional copy.
 * @returns A React element for the query error alert, or null when no query has failed.
 * @example
 * import { createElement } from 'react';
 * import { QueryErrorAlert } from 'jg-react-ui/components/query-error-alert';
 * const query = { error: new Error('Private diagnostics'), isError: true, refetch: async () => undefined };
 * const example = createElement(QueryErrorAlert, { presentation: 'blocking', queries: [query] });
 */
export const QueryErrorAlert = ({
  className,
  presentation,
  queries,
  title,
  fallbackMessage,
  retryLabel = 'Retry',
  retryingLabel = 'Retrying',
  ...props
}: IQueryErrorAlertProps): ReactElement | null => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const isRetryingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const failedQueries = useMemo(
    () => getFailedQueries(queries, resolveErrorFeedback),
    [queries, resolveErrorFeedback],
  );
  const firstFailedQuery = failedQueries[0] ?? null;

  /**
   * Retries failed queries in place while preserving visible failure feedback.
   * @returns A promise that resolves after every retry attempt settles.
   */
  const handleRetry = useCallback(async (): Promise<void> => {
    if (failedQueries.length === 0 || isRetryingRef.current) {
      return;
    }

    isRetryingRef.current = true;
    setIsRetrying(true);

    try {
      await Promise.allSettled(failedQueries.map(async (query) => query.refetch()));
    } finally {
      isRetryingRef.current = false;
      setIsRetrying(false);
    }
  }, [failedQueries]);

  // if there are no failed queries, render nothing
  if (firstFailedQuery === null) {
    return null;
  }

  // otherwise, show the first error and retry action
  const errorDetails = getQueryErrorDetails(
    firstFailedQuery.error,
    resolveErrorFeedback,
    fallbackMessage,
  );
  const resolvedTitle =
    title ?? (presentation === 'retained' ? 'Could not update' : 'Could not load');
  const isRetryDisabled = isRetrying || failedQueries.some(isQueryFetching);
  const retryButtonLabel = isRetrying ? retryingLabel : retryLabel;

  return (
    <Alert
      data-slot="query-error-alert"
      data-presentation={presentation}
      variant="destructive"
      className={cn(
        presentation === 'blocking'
          ? 'mt-3 grid justify-items-center gap-3 px-4 py-5 text-center sm:px-5 md:mt-4'
          : 'mt-3 flex items-start gap-3 px-3 py-3 text-left md:mt-4',
        className,
      )}
      {...props}
    >
      <IconTile
        size={presentation === 'blocking' ? 'lg' : 'md'}
        tone="destructive"
      >
        <TriangleAlert aria-hidden="true" />
      </IconTile>

      <div
        className={cn(
          'grid min-w-0 gap-3',
          presentation === 'blocking'
            ? 'w-full max-w-md justify-items-center'
            : 'w-full gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
        )}
      >
        <div
          className={cn(
            'grid min-w-0 gap-2',
            presentation === 'blocking' && 'justify-items-center',
          )}
        >
          <AlertTitle>{resolvedTitle}</AlertTitle>

          <AlertDescription className="mt-0">
            <span className="block">{errorDetails.message}</span>
          </AlertDescription>

          {errorDetails.code !== null ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    data-slot="query-error-alert-code-trigger"
                    tabIndex={0}
                    className="focus-visible:ring-destructive/20 focus-visible:ring-offset-background dark:focus-visible:ring-destructive/40 inline-flex max-w-full cursor-help rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    <Badge
                      variant="destructive"
                      className="max-w-full justify-start rounded-md font-mono"
                    >
                      <span
                        data-slot="query-error-alert-code"
                        className="min-w-0 truncate"
                      >
                        Code {errorDetails.code}
                      </span>
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-[min(calc(100vw-2rem),32rem)] text-left break-all">
                  {errorDetails.code}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>

        <Button
          type="button"
          variant="destructive"
          size={presentation === 'blocking' ? 'touch' : 'sm'}
          className={cn(
            'min-w-0 whitespace-normal wrap-anywhere pointer-coarse:min-h-11 pointer-coarse:min-w-11',
            presentation === 'blocking' ? 'w-full' : 'w-full sm:w-auto',
          )}
          disabled={isRetryDisabled}
          aria-label={retryButtonLabel}
          onClick={() => void handleRetry()}
        >
          {isRetrying ? (
            <Spinner
              data-icon="inline-start"
              aria-hidden="true"
            />
          ) : (
            <RefreshCcw
              data-icon="inline-start"
              aria-hidden="true"
            />
          )}
          <span>{retryButtonLabel}</span>
        </Button>
      </div>
    </Alert>
  );
};
