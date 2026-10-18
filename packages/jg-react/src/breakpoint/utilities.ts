import { BREAKPOINT_WIDTHS, BREAKPOINTS_WIDEST_FIRST, PIXELS_PER_REM } from './constants.js';
import type { IBreakpoint } from './types.js';

/**
 * Builds the media query a breakpoint starts at.
 * @param breakpoint The breakpoint.
 * @returns The query, such as `(min-width: 40rem)`.
 */
const toMediaQuery = (breakpoint: IBreakpoint): string =>
  `(min-width: ${String(BREAKPOINT_WIDTHS[breakpoint])}rem)`;

/**
 * Checks whether the browser can evaluate media queries.
 * @returns Whether window.matchMedia exists.
 */
const canMatchMedia = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Finds the breakpoint of a viewport width, in pixels at 16 per rem.
 * @param width The width, in pixels.
 * @returns The widest breakpoint the width reaches.
 */
export const getBreakpointFromWidth = (width: number): IBreakpoint =>
  BREAKPOINTS_WIDEST_FIRST.find(
    (breakpoint) => breakpoint !== 'xs' && width >= BREAKPOINT_WIDTHS[breakpoint] * PIXELS_PER_REM,
  ) ?? 'xs';

/**
 * Checks whether a breakpoint is at least as wide as another, such as to show a sidebar from md
 * up. An unknown breakpoint, as in a server render, is never wide enough.
 * @param breakpoint The current breakpoint, from useBreakpoint.
 * @param minimum The narrowest breakpoint that counts.
 * @returns Whether the breakpoint reaches the minimum.
 * @example
 * import { isBreakpointAtLeast } from 'jg-react';
 *
 * isBreakpointAtLeast('lg', 'md'); // => true
 * isBreakpointAtLeast('xs', 'sm'); // => false
 * isBreakpointAtLeast(undefined, 'xs'); // => false
 */
export const isBreakpointAtLeast = (
  breakpoint: IBreakpoint | undefined,
  minimum: IBreakpoint,
): boolean =>
  breakpoint !== undefined && BREAKPOINT_WIDTHS[breakpoint] >= BREAKPOINT_WIDTHS[minimum];

/**
 * Subscribes to the viewport crossing a breakpoint: through each breakpoint's media query, or
 * through resizes where the browser can't evaluate media queries.
 * @param notify Called on every change.
 * @returns The unsubscribe function.
 */
export const subscribeToBreakpoint = (notify: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  if (!canMatchMedia()) {
    window.addEventListener('resize', notify);
    return () => {
      window.removeEventListener('resize', notify);
    };
  }
  const queries = BREAKPOINTS_WIDEST_FIRST.filter((breakpoint) => breakpoint !== 'xs').map(
    (breakpoint) => window.matchMedia(toMediaQuery(breakpoint)),
  );
  for (const query of queries) {
    query.addEventListener('change', notify);
  }
  return () => {
    for (const query of queries) {
      query.removeEventListener('change', notify);
    }
  };
};

/**
 * Reads the viewport's breakpoint: the widest one whose media query matches, or xs, such as on a
 * phone, where none does.
 * @returns The breakpoint, or undefined without a window.
 */
export const getBreakpointSnapshot = (): IBreakpoint | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  if (!canMatchMedia()) {
    return getBreakpointFromWidth(window.innerWidth);
  }
  return (
    BREAKPOINTS_WIDEST_FIRST.find(
      (breakpoint) => breakpoint !== 'xs' && window.matchMedia(toMediaQuery(breakpoint)).matches,
    ) ?? 'xs'
  );
};

/**
 * The breakpoint a server renders: unknown, since a server has no viewport.
 * @returns Always undefined.
 */
export const getServerBreakpointSnapshot = (): IBreakpoint | undefined => undefined;
