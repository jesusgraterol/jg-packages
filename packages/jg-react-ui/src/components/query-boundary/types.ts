import { type ReactNode } from 'react';
import type { IQueryExecutionState, IQueryInitialResolutionState } from 'jg-tanstack-query';

import type { ILoadMoreButtonProps } from '../load-more-button/index.js';
import type { IQueryErrorAlertProps, IQueryErrorAlertQuery } from '../query-error-alert/index.js';
import type { IQueryLoaderProps } from '../query-loader/index.js';

/** Query boundary accepts route query state and optional first-query pagination support.
 * @see IQueryBoundaryQuery
 */
export type IQueryBoundaryQuery = IQueryErrorAlertQuery &
  IQueryExecutionState & {
    data: unknown;
    fetchNextPage?: () => unknown;
  } & IQueryInitialResolutionState;

/** Error alert props are passed through while QueryBoundary owns the shared query list.
 * @see IQueryBoundaryErrorAlertProps
 */
export type IQueryBoundaryErrorAlertProps = Omit<IQueryErrorAlertProps, 'presentation' | 'queries'>;

/** Loader props are passed through while QueryBoundary owns the shared query list.
 * @see IQueryBoundaryLoaderProps
 */
export type IQueryBoundaryLoaderProps = Omit<IQueryLoaderProps, 'isVisible' | 'queries'>;

/** Load-more props are passed through while QueryBoundary owns the first query as the source.
 * @see IQueryBoundaryLoadMoreButtonProps
 */
export type IQueryBoundaryLoadMoreButtonProps = Omit<ILoadMoreButtonProps, 'query'>;

/** Render callbacks let consumers replace any default query feedback primitive.
 * @see IQueryBoundaryRenderErrorAlert
 */
export type IQueryBoundaryRenderErrorAlert = (props: IQueryErrorAlertProps) => ReactNode;

/** Renderer for the loader slot.
 * @see QueryBoundary
 */
export type IQueryBoundaryRenderLoader = (props: IQueryLoaderProps) => ReactNode;

/** Renderer for the pagination slot.
 * @see QueryBoundary
 */
export type IQueryBoundaryRenderLoadMoreButton = (props: ILoadMoreButtonProps) => ReactNode;

/** Query boundary props compose query feedback primitives around optional content.
 * @see IQueryBoundaryProps
 */
export type IQueryBoundaryProps = {
  children?: ReactNode;
  errorAlertProps?: false | IQueryBoundaryErrorAlertProps;
  loaderProps?: false | IQueryBoundaryLoaderProps;
  loadMoreButtonProps?: false | IQueryBoundaryLoadMoreButtonProps;
  queries: readonly IQueryBoundaryQuery[];
  // changes identify a new logical query resolution that must earn initial visibility independently.
  resolutionKey: string;
  // trusted caller state can preserve an already-approved resolution across boundary remounts.
  isInitialResolutionApproved?: boolean;
  renderErrorAlert?: IQueryBoundaryRenderErrorAlert;
  renderLoader?: IQueryBoundaryRenderLoader;
  renderLoadMoreButton?: IQueryBoundaryRenderLoadMoreButton;
};
