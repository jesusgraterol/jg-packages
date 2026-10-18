import type { IBreakpoint } from './types.js';

// Tailwind CSS's default breakpoints, each the viewport's least width, in rem
export const BREAKPOINT_WIDTHS: Readonly<Record<IBreakpoint, number>> = {
  xs: 0,
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
};

// the breakpoints from the widest, so the first one whose width the viewport reaches is current
export const BREAKPOINTS_WIDEST_FIRST: readonly IBreakpoint[] = [
  '2xl',
  'xl',
  'lg',
  'md',
  'sm',
  'xs',
];

// the pixels in a rem, where a browser can't evaluate media queries
export const PIXELS_PER_REM = 16;
