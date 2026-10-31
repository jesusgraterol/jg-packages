import { type ComponentProps } from 'react';
import type { IQueryExecutionState } from 'jg-tanstack-query';

import type {
  QUERY_LOADER_LAYOUT_CLASS_NAMES,
  QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES,
} from './constants.js';

/** Query loader query state follows the shared app-query execution flags.
 * @see IQueryLoaderQuery
 */
export type IQueryLoaderQuery = IQueryExecutionState;

/** Query loader size controls the spinner icon dimensions.
 * @see IQueryLoaderSize
 */
export type IQueryLoaderSize = keyof typeof QUERY_LOADER_SPINNER_SIZE_CLASS_NAMES;

/** Query loader layout controls which surrounding surface owns vertical centering.
 * @see IQueryLoaderLayout
 */
export type IQueryLoaderLayout = keyof typeof QUERY_LOADER_LAYOUT_CLASS_NAMES;

/** Query loader class overrides target the wrapper and spinner separately.
 * @see IQueryLoaderClassNames
 */
export type IQueryLoaderClassNames = {
  root?: string;
  spinner?: string;
};

/** Query loader props expose query state, wrapper attributes, and spinner presentation.
 * @see IQueryLoaderProps
 */
export type IQueryLoaderProps = Omit<ComponentProps<'div'>, 'children'> & {
  queries: readonly IQueryLoaderQuery[];
  classNames?: IQueryLoaderClassNames;
  // explicit visibility lets a coordinating boundary own compound initial-resolution state.
  isVisible?: boolean;
  layout?: IQueryLoaderLayout;
  size?: IQueryLoaderSize;
};
