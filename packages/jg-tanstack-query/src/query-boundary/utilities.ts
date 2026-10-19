import { isQueryReadyForInitialDisplay } from '../query-state/index.js';

import type {
  IBoundarySignals,
  IInitialResolution,
  IQueryBoundaryQuery,
  IQueryBoundaryState,
} from './types.js';

/**
 * Checks whether every query has data, and none reports an access loss.
 * @param queries The queries.
 * @param hasAccessLoss Whether a query lost access.
 * @returns Whether the content has data to show.
 */
const haveData = (queries: readonly IQueryBoundaryQuery[], hasAccessLoss: boolean): boolean =>
  !hasAccessLoss && queries.every((query) => query.data !== undefined);

/**
 * Reads what the queries say about the content.
 * @param queries The queries.
 * @param isAccessDenied Whether an error means the user lost access.
 * @param isInitialResolutionApproved Whether the app already approved the key's data.
 * @returns The signals.
 */
export const readBoundarySignals = (
  queries: readonly IQueryBoundaryQuery[],
  isAccessDenied: (error: unknown) => boolean,
  isInitialResolutionApproved: boolean,
): IBoundarySignals => {
  const hasAccessLoss = queries.some((query) => query.isError && isAccessDenied(query.error));
  const isReadyForInitialDisplay = queries.every(isQueryReadyForInitialDisplay);
  return {
    isInitialResolutionApproved,
    hasAccessLoss,
    isReadyForInitialDisplay,
    // every query settled with current data, which content hidden by an access loss waits for
    canConfirmResolution:
      isReadyForInitialDisplay &&
      haveData(queries, hasAccessLoss) &&
      queries.every(
        (query) =>
          query.isPending !== true &&
          query.isLoading !== true &&
          query.isFetching !== true &&
          query.isRefetching !== true,
      ),
  };
};

/**
 * Starts the resolution of a key: complete at once when the app approved it or the data is fresh,
 * unless access is lost.
 * @param key The resolution key.
 * @param signals The queries' signals.
 * @returns The resolution.
 */
export const createInitialResolution = (
  key: string,
  { hasAccessLoss, isInitialResolutionApproved, isReadyForInitialDisplay }: IBoundarySignals,
): IInitialResolution => ({
  key,
  isComplete: !hasAccessLoss && (isInitialResolutionApproved || isReadyForInitialDisplay),
  hasLostAccess: hasAccessLoss,
});

/**
 * Moves a resolution forward after a render: a new key starts over, an access loss undoes it, and
 * content hidden by an access loss returns only once every query settles with current data. It
 * returns the same resolution when nothing changes, so committing it renders nothing more.
 * @param current The resolution so far.
 * @param key The current resolution key.
 * @param signals The queries' signals.
 * @returns The next resolution.
 */
export const advanceInitialResolution = (
  current: IInitialResolution,
  key: string,
  signals: IBoundarySignals,
): IInitialResolution => {
  if (current.key !== key) {
    return createInitialResolution(key, signals);
  }
  if (signals.hasAccessLoss) {
    return current.hasLostAccess ? current : { ...current, isComplete: false, hasLostAccess: true };
  }
  if (current.hasLostAccess) {
    return signals.canConfirmResolution
      ? { ...current, isComplete: true, hasLostAccess: false }
      : current;
  }
  if (
    !current.isComplete &&
    (signals.isInitialResolutionApproved || signals.isReadyForInitialDisplay)
  ) {
    return { ...current, isComplete: true };
  }
  return current;
};

/**
 * Derives what a boundary shows in a render. A key that differs from the resolution's, and an
 * access loss, hide the content in the same render, before any effect runs.
 * @param resolution The resolution committed so far.
 * @param key The current resolution key.
 * @param queries The queries.
 * @param signals The queries' signals.
 * @returns Everything the boundary returns but retryFailed.
 */
export const deriveBoundaryOutputs = <TQuery extends IQueryBoundaryQuery>(
  resolution: IInitialResolution,
  key: string,
  queries: readonly TQuery[],
  { hasAccessLoss }: IBoundarySignals,
): Omit<IQueryBoundaryState<TQuery>, 'retryFailed'> => {
  const isResolved = resolution.key === key && resolution.isComplete;
  const hasData = haveData(queries, hasAccessLoss);
  const failedQueries = queries.filter((query) => query.isError);
  const hasError = failedQueries.length > 0;
  const canRenderContent = isResolved && hasData;
  const [firstQuery] = queries;
  return {
    canRenderContent,
    isLoaderVisible: !hasError && !canRenderContent,
    hasError,
    errorPresentation: canRenderContent ? 'retained' : 'blocking',
    failedQueries,
    loadMoreQuery:
      canRenderContent && typeof firstQuery?.fetchNextPage === 'function' ? firstQuery : undefined,
  };
};

/**
 * Keeps the previous list when it holds the same queries, in the same order, so a result built
 * from it keeps its identity across renders that change nothing.
 * @param previous The list from the last commit.
 * @param next The list from this render.
 * @returns The previous list when it's equal, otherwise the next one.
 */
export const reuseIfSameQueries = <TQuery>(previous: TQuery[], next: TQuery[]): TQuery[] =>
  previous.length === next.length && previous.every((query, index) => Object.is(query, next[index]))
    ? previous
    : next;
