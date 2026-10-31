import { useCallback, type ComponentProps, type ReactElement } from 'react';
import { useQueryBoundary } from 'jg-tanstack-query';

import { useErrorFeedbackResolver } from '../error-feedback-provider/index.js';

import { LoadMoreButton } from '../load-more-button/index.js';
import { QueryErrorAlert } from '../query-error-alert/index.js';
import { QueryLoader } from '../query-loader/index.js';
import type { IQueryBoundaryProps } from './types.js';
import { isQueryBoundaryPaginationQuery } from './utilities.js';

/**
 * Renders the default query error alert slot.
 * @param props The query error alert props resolved by QueryBoundary.
 * @returns A React node containing the query error alert.
 */
const renderDefaultErrorAlert = (props: ComponentProps<typeof QueryErrorAlert>) => (
  <QueryErrorAlert {...props} />
);

/**
 * Renders the default query loader slot.
 * @param props The query loader props resolved by QueryBoundary.
 * @returns A React node containing the query loader.
 */
const renderDefaultLoader = (props: ComponentProps<typeof QueryLoader>) => (
  <QueryLoader {...props} />
);

/**
 * Renders the default load-more button slot.
 * @param props The load-more button props resolved by QueryBoundary.
 * @returns A React node containing the load-more button.
 */
const renderDefaultLoadMoreButton = (props: ComponentProps<typeof LoadMoreButton>) => (
  <LoadMoreButton {...props} />
);

/**
 * Composes query feedback while protecting content across initial and background resolution states.
 * @param props The shared query list, optional content, pass-through props, and render overrides.
 * @returns A React element containing the enabled query boundary slots.
 * @example
 * import { createElement } from 'react';
 * import { QueryBoundary } from 'jg-react-ui/components/query-boundary';
 * const query = { data: 'Current data', error: null, isError: false, isStale: false, isFetchedAfterMount: true, refetch: async () => undefined };
 * const example = createElement(QueryBoundary, { queries: [query], resolutionKey: 'records', children: 'Records' });
 */
export const QueryBoundary = ({
  children,
  errorAlertProps,
  loaderProps,
  loadMoreButtonProps,
  queries,
  resolutionKey,
  isInitialResolutionApproved = false,
  renderErrorAlert = renderDefaultErrorAlert,
  renderLoader = renderDefaultLoader,
  renderLoadMoreButton = renderDefaultLoadMoreButton,
}: IQueryBoundaryProps): ReactElement => {
  const resolveErrorFeedback = useErrorFeedbackResolver();
  const isAccessDenied = useCallback(
    (error: unknown) => resolveErrorFeedback(error).isAccessDenied,
    [resolveErrorFeedback],
  );
  const { canRenderContent, isLoaderVisible, errorPresentation, loadMoreQuery } = useQueryBoundary({
    queries,
    resolutionKey,
    isInitialResolutionApproved,
    isAccessDenied,
  });

  return (
    <>
      {errorAlertProps === false
        ? null
        : renderErrorAlert({ presentation: errorPresentation, queries, ...errorAlertProps })}
      {loaderProps === false
        ? null
        : renderLoader({ queries, ...loaderProps, isVisible: isLoaderVisible })}
      {canRenderContent ? children : null}
      {!canRenderContent ||
      loadMoreButtonProps === false ||
      !isQueryBoundaryPaginationQuery(loadMoreQuery)
        ? null
        : renderLoadMoreButton({
            query: loadMoreQuery,
            ...loadMoreButtonProps,
          })}
    </>
  );
};
