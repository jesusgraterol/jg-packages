import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type {
  IQueryBoundaryQuery,
  IQueryBoundaryState,
  IUseQueryBoundaryOptions,
} from './types.js';
import {
  advanceInitialResolution,
  createInitialResolution,
  deriveBoundaryOutputs,
  readBoundarySignals,
  reuseIfSameQueries,
} from './utilities.js';

// the default access check: no error means the user lost access
const IS_NEVER_ACCESS_DENIED = (): boolean => false;

/**
 * Decides what a screen shows around the queries its content needs, without rendering anything,
 * so any design system can draw the loader, the error, and the content.
 *
 * The content waits until every query has data for the current `resolutionKey` that's fresh, or
 * fetched since mount, so stale cached data never shows as current. Once it shows, refetches,
 * pagination, and background errors keep it on screen, with `errorPresentation: 'retained'`. A new
 * key, or an error `isAccessDenied` recognizes, hides it in the same render; after an access loss,
 * it returns only once every query settles with current data, even with
 * `isInitialResolutionApproved`.
 * @param options The queries, the key of what they show, whether the app already approved its
 * data, and how to recognize a lost access.
 * @returns Whether to render the content or a loader, the error state and the failed queries, the
 * query for a load-more control, and a stable retryFailed. The result keeps its identity while
 * none of it changes.
 * @example
 * import { useQuery } from '@tanstack/react-query';
 * import { useQueryBoundary } from 'jg-tanstack-query';
 *
 * declare const fetchProject: (id: string) => Promise<{ name: string }>;
 *
 * export const useProjectBoundary = (projectId: string) => {
 *   const project = useQuery({
 *     queryKey: ['project', projectId],
 *     queryFn: () => fetchProject(projectId),
 *   });
 *   const boundary = useQueryBoundary({ queries: [project], resolutionKey: projectId });
 *   return { project, boundary };
 * };
 */
export const useQueryBoundary = <TQuery extends IQueryBoundaryQuery>({
  queries,
  resolutionKey,
  isInitialResolutionApproved = false,
  isAccessDenied = IS_NEVER_ACCESS_DENIED,
}: IUseQueryBoundaryOptions<TQuery>): IQueryBoundaryState<TQuery> => {
  const signals = readBoundarySignals(queries, isAccessDenied, isInitialResolutionApproved);
  const { hasAccessLoss, isReadyForInitialDisplay, canConfirmResolution } = signals;
  const [resolution, setResolution] = useState(() =>
    createInitialResolution(resolutionKey, signals),
  );

  // commits the transition this render's signals call for; an unchanged resolution renders nothing
  useEffect(() => {
    setResolution((current) =>
      advanceInitialResolution(current, resolutionKey, {
        isInitialResolutionApproved,
        hasAccessLoss,
        isReadyForInitialDisplay,
        canConfirmResolution,
      }),
    );
  }, [
    canConfirmResolution,
    hasAccessLoss,
    isInitialResolutionApproved,
    isReadyForInitialDisplay,
    resolutionKey,
  ]);

  const outputs = deriveBoundaryOutputs(resolution, resolutionKey, queries, signals);
  const { canRenderContent, isLoaderVisible, hasError, errorPresentation, loadMoreQuery } = outputs;

  // the committed failed queries, which retryFailed reads and an equal list reuses
  const committedFailedQueries = useRef<TQuery[]>([]);
  const failedQueries = reuseIfSameQueries(committedFailedQueries.current, outputs.failedQueries);
  useLayoutEffect(() => {
    committedFailedQueries.current = failedQueries;
  }, [failedQueries]);

  const retryFailed = useCallback(async (): Promise<void> => {
    await Promise.allSettled(committedFailedQueries.current.map((query) => query.refetch?.()));
  }, []);

  return useMemo(
    () => ({
      canRenderContent,
      isLoaderVisible,
      hasError,
      errorPresentation,
      failedQueries,
      loadMoreQuery,
      retryFailed,
    }),
    [
      canRenderContent,
      errorPresentation,
      failedQueries,
      hasError,
      isLoaderVisible,
      loadMoreQuery,
      retryFailed,
    ],
  );
};
