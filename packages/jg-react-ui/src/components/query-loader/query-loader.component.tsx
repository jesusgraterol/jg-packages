import { type ReactElement } from 'react';
import { cn } from 'cnfast';
import { isQueryLoading } from 'jg-tanstack-query';

import { Spinner } from '../spinner/index.js';
import {
  QUERY_LOADER_LAYOUT_CLASS_NAMES,
  QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES,
} from './constants.js';
import type { IQueryLoaderProps } from './types.js';

/**
 * Renders a centered spinner while any provided query is loading or visibility is requested.
 * @param props The structural query results and optional wrapper or spinner presentation.
 * @returns A React element for the loader, or null when every query has settled.
 * @example
 * import { createElement } from 'react';
 * import { QueryLoader } from 'jg-react-ui/components/query-loader';
 * const example = createElement(QueryLoader, { queries: [{ isError: false, isPending: true }], layout: 'dialog' });
 */
export const QueryLoader = ({
  className,
  classNames,
  isVisible,
  layout = 'inline',
  queries,
  size = 'lg',
  role = 'status',
  'aria-label': ariaLabel = 'Loading data',
  ...props
}: IQueryLoaderProps): ReactElement | null => {
  const isLoaderVisible = isVisible ?? queries.some(isQueryLoading);

  if (!isLoaderVisible) {
    return null;
  }

  return (
    <div
      data-slot="query-loader"
      data-layout={layout}
      className={cn(
        'inline-flex w-full items-center justify-center',
        QUERY_LOADER_LAYOUT_CLASS_NAMES[layout],
        className,
        classNames?.root,
      )}
      role={role}
      aria-label={ariaLabel}
      {...props}
    >
      <Spinner
        aria-hidden="true"
        className={cn(QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES[size], classNames?.spinner)}
      />
    </div>
  );
};
