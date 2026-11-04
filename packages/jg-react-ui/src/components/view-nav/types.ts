import type { To } from 'react-router';

/** One view a page offers: its key, its label and where its link goes.
 * @see ViewNav
 */
export type IViewNavItem<TValue extends string> = { value: TValue; label: string; to: To };

/** Options for ViewNav: what the row is called, its views, the selected one, and how its links
 * navigate, such as replacing the history entry and keeping the scroll for a page's own sections.
 * @see ViewNav
 */
export type IViewNavProps<TValue extends string> = {
  label: string;
  items: readonly IViewNavItem<TValue>[];
  current: TValue;
  replace?: boolean;
  preventScrollReset?: boolean;
  // the router state its links keep, such as the page's way back
  state?: unknown;
  className?: string;
};
