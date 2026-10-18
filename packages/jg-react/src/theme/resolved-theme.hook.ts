import { useCallback, useSyncExternalStore } from 'react';

import type { IResolvedTheme, IThemePreference } from './types.js';
import {
  getSystemDarkSchemeSnapshot,
  resolveThemePreference,
  subscribeToNothing,
  subscribeToSystemDarkScheme,
} from './utilities.js';

/**
 * Resolves a theme preference to the theme a page shows, following the system's color scheme
 * while the preference is `system`, and re-rendering when it changes. A server render, which
 * can't read the system, gives `dark` for `dark` and `light` otherwise.
 * @param preference The user's preference.
 * @returns `light` or `dark`.
 * @example
 * import { useResolvedTheme } from 'jg-react';
 *
 * export const CodeBlock = ({ preference }: { preference: 'light' | 'dark' | 'system' }) => {
 *   const theme = useResolvedTheme(preference);
 *   return theme === 'dark' ? 'github-dark' : 'github-light';
 * };
 */
export const useResolvedTheme = (preference: IThemePreference): IResolvedTheme => {
  const getSnapshot = useCallback(
    (): IResolvedTheme => resolveThemePreference(preference, getSystemDarkSchemeSnapshot()),
    [preference],
  );
  const getServerSnapshot = useCallback(
    (): IResolvedTheme => (preference === 'dark' ? 'dark' : 'light'),
    [preference],
  );
  return useSyncExternalStore(
    preference === 'system' ? subscribeToSystemDarkScheme : subscribeToNothing,
    getSnapshot,
    getServerSnapshot,
  );
};
