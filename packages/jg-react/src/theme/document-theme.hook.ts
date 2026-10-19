import { useSyncExternalStore } from 'react';

import type { IResolvedTheme } from './types.js';
import { readDocumentTheme, subscribeToDocumentTheme } from './utilities.js';

// a server can't read the page's class, so it renders the light theme, as the init script's
// fallback does
const getServerSnapshot = (): IResolvedTheme => 'light';

/**
 * Reads the theme the page shows from `<html>`'s class, as useAppliedTheme and
 * createThemeInitScript write it: `dark` wins, then `light`, then the system's color scheme. It
 * re-renders only when that theme changes, not for another class, so a component far from the
 * one applying the theme, such as a chart, can follow it without the user's preference. A server
 * render, and so the hydration render, reads `light`.
 * @returns `light` or `dark`.
 * @example
 * import { useDocumentTheme } from 'jg-react';
 *
 * export const useChartColors = () =>
 *   useDocumentTheme() === 'dark' ? { line: '#93c5fd' } : { line: '#1d4ed8' };
 */
export const useDocumentTheme = (): IResolvedTheme =>
  useSyncExternalStore(subscribeToDocumentTheme, readDocumentTheme, getServerSnapshot);
