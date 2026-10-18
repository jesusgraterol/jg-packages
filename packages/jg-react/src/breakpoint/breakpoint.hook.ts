import { useSyncExternalStore } from 'react';

import type { IBreakpoint } from './types.js';
import {
  getBreakpointSnapshot,
  getServerBreakpointSnapshot,
  subscribeToBreakpoint,
} from './utilities.js';

/**
 * Reports the viewport's Tailwind CSS breakpoint, re-rendering only when the viewport crosses one:
 * xs below sm, such as on a phone, then sm, md, lg, xl, and 2xl. A server render, which has no
 * viewport, reports undefined, so prefer CSS for layout and this for what CSS can't do.
 * @returns The breakpoint, or undefined in a server render.
 * @example
 * import { isBreakpointAtLeast, useBreakpoint } from 'jg-react';
 *
 * export const useIsDesktopLayout = (): boolean => isBreakpointAtLeast(useBreakpoint(), 'lg');
 */
export const useBreakpoint = (): IBreakpoint | undefined =>
  useSyncExternalStore(subscribeToBreakpoint, getBreakpointSnapshot, getServerBreakpointSnapshot);
