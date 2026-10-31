import { type ReactNode } from 'react';
import type { IQueryExecutionState } from 'jg-tanstack-query';

import type { IButtonProps } from '../button/index.js';

/** Load-more query shape stays data-library agnostic while matching infinite query result fields.
 * @see ILoadMoreButtonQuery
 */
export type ILoadMoreButtonQuery = IQueryExecutionState & {
  fetchNextPage: () => unknown;
};

/** Load-more icon placement controls which side receives shared button icon spacing.
 * @see ILoadMoreButtonIconPlacement
 */
export type ILoadMoreButtonIconPlacement = 'start' | 'end';

/** Load-more button slot class overrides target the button, icon, and visible label.
 * @see ILoadMoreButtonClassNames
 */
export type ILoadMoreButtonClassNames = {
  button?: string;
  icon?: string;
  label?: string;
};

/** Load-more button props expose the query, copy, icon, slots, and shared button controls.
 * @see ILoadMoreButtonProps
 */
export type ILoadMoreButtonProps = Omit<
  IButtonProps,
  'asChild' | 'children' | 'className' | 'type'
> & {
  className?: string;
  classNames?: ILoadMoreButtonClassNames;
  icon?: ReactNode;
  iconPlacement?: ILoadMoreButtonIconPlacement;
  label?: ReactNode;
  loadingAriaLabel?: string;
  loadingIcon?: ReactNode;
  loadingLabel?: ReactNode;
  query: ILoadMoreButtonQuery;
  shouldDisableWhenLoading?: boolean;
};
