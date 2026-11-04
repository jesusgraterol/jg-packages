import { useCallback, useLayoutEffect, useRef } from 'react';
import type * as React from 'react';
import { Link } from 'react-router';
import { cn } from 'cnfast';

import { buttonVariants } from '../button/index.js';

import type { IViewNavProps } from './types.js';
import { revealInRow } from './utilities.js';

/**
 * Renders the views a page switches between as a row of link buttons, never tabs: the selected
 * one filled and marked as the current page. The row scrolls sideways when it doesn't fit, with
 * complete labels, showing the whole of the selected link and of a link the keyboard focuses,
 * without scrolling the page.
 * @param props What the row is called, its views, the selected one, how its links navigate and
 * the router state they keep.
 * @returns A React element that renders the row.
 * @example
 * import { createElement } from 'react';
 * import { ViewNav } from 'jg-react-ui/components/view-nav';
 * const example = createElement(ViewNav, {
 *   label: 'Session views',
 *   current: 'events',
 *   items: [
 *     { value: 'events', label: 'Events', to: '?view=events' },
 *     { value: 'files', label: 'Files', to: '?view=files' },
 *   ],
 * });
 */
export const ViewNav = <TValue extends string>({
  label,
  items,
  current,
  replace = false,
  preventScrollReset = false,
  state,
  className,
}: IViewNavProps<TValue>): React.ReactElement => {
  const rowRef = useRef<HTMLElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useLayoutEffect(() => {
    revealInRow(rowRef.current, currentRef.current);
  }, [current]);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLAnchorElement>) => {
    revealInRow(rowRef.current, event.currentTarget);
  }, []);

  return (
    <nav
      ref={rowRef}
      aria-label={label}
      data-slot="view-nav"
      className={cn(
        'flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none]',
        className,
      )}
    >
      {items.map((item) => (
        <Link
          key={item.value}
          ref={item.value === current ? currentRef : undefined}
          aria-current={item.value === current ? 'page' : undefined}
          className={buttonVariants({
            size: 'touch',
            variant: item.value === current ? 'secondary' : 'ghost',
            className: 'shrink-0',
          })}
          preventScrollReset={preventScrollReset}
          replace={replace}
          state={state}
          to={item.to}
          onFocus={handleFocus}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};
