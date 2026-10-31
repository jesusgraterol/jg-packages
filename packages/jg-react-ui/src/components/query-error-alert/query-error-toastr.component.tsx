import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { toastr } from '../toastr/index.js';
import type { IQueryErrorToastrProps } from './types.js';
import { getFailedQueries, getQueryErrorDetails, isQueryFetching } from './utilities.js';

// owner tokens keep deferred unmount cleanup from dismissing a same-ID replacement toast.
const QUERY_ERROR_TOAST_OWNERS = new Map<string | number, symbol>();

/**
 * Presents retained query failures through one persistent, retryable toast without affecting layout.
 * @param props The failed queries, stable toast identity, and optional recovery copy.
 * @returns No layout node. Feedback is published through the shared toastr host.
 * @example
 * import { createElement } from 'react';
 * import { QueryErrorToastr } from 'jg-react-ui/components/query-error-alert';
 * const query = { error: new Error('Private diagnostics'), isError: true, refetch: async () => undefined };
 * const example = createElement(QueryErrorToastr, { toastId: 'records-refresh', queries: [query] });
 */
export const QueryErrorToastr = ({
  queries,
  toastId,
  title = 'Could not update',
  fallbackMessage,
  retryLabel = 'Retry',
  retryingLabel = 'Retrying',
}: IQueryErrorToastrProps): null => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const resolverRef = useRef(resolveErrorFeedback);
  const queriesRef = useRef(queries);
  const isMountedRef = useRef(false);
  const isRetryingRef = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const failedQueries = getFailedQueries(queries, resolveErrorFeedback);
  const firstFailedQuery = failedQueries[0] ?? null;
  const errorDetails =
    firstFailedQuery === null
      ? null
      : getQueryErrorDetails(firstFailedQuery.error, resolveErrorFeedback, fallbackMessage);
  const errorCode = errorDetails?.code ?? null;
  const errorMessage = errorDetails?.message ?? null;
  const hasActiveFetch = failedQueries.some(isQueryFetching);

  useLayoutEffect(() => {
    queriesRef.current = queries;
    resolverRef.current = resolveErrorFeedback;
  }, [queries, resolveErrorFeedback]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Retries the latest failed-query set once while ignoring repeated actions and active fetches.
   * @returns A promise that resolves after every retry attempt settles.
   */
  const handleRetry = useCallback(async (): Promise<void> => {
    const currentFailedQueries = getFailedQueries(queriesRef.current, resolverRef.current);

    if (
      !isMountedRef.current ||
      isRetryingRef.current ||
      currentFailedQueries.length === 0 ||
      currentFailedQueries.some(isQueryFetching)
    ) {
      return;
    }

    isRetryingRef.current = true;

    if (isMountedRef.current) {
      setIsRetrying(true);
    }

    try {
      await Promise.allSettled(currentFailedQueries.map(async (query) => query.refetch()));
    } finally {
      isRetryingRef.current = false;

      if (isMountedRef.current) {
        setIsRetrying(false);
      }
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    // sibling hosts subscribe in passive effects too, including after this component mounts.
    queueMicrotask(() => {
      if (!isCurrent) return;
      if (errorMessage === null) {
        toastr.dismiss(toastId);
        return;
      }
      const description = errorCode === null ? errorMessage : `${errorMessage} Code ${errorCode}`;
      const isRetryBlocked = isRetrying || hasActiveFetch;
      toastr.error(title, {
        action: {
          label: isRetryBlocked ? retryingLabel : retryLabel,
          onClick: (event) => {
            // Sonner otherwise dismisses action toasts as soon as the action runs.
            event.preventDefault();
            void handleRetry();
          },
        },
        description,
        dismissible: false,
        duration: Number.POSITIVE_INFINITY,
        id: toastId,
      });
    });
    return () => {
      isCurrent = false;
    };
  }, [
    errorCode,
    errorMessage,
    handleRetry,
    hasActiveFetch,
    isRetrying,
    retryLabel,
    retryingLabel,
    title,
    toastId,
  ]);

  useEffect(() => {
    const owner = Symbol();

    QUERY_ERROR_TOAST_OWNERS.set(toastId, owner);

    return () => {
      queueMicrotask(() => {
        if (QUERY_ERROR_TOAST_OWNERS.get(toastId) !== owner) {
          return;
        }

        QUERY_ERROR_TOAST_OWNERS.delete(toastId);
        toastr.dismiss(toastId);
      });
    };
  }, [toastId]);

  return null;
};
