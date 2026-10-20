import { useLayoutEffect } from 'react';
import type { IResolvedTheme, IThemePreference } from 'jg-site';

import { useResolvedTheme } from './resolved-theme.hook.js';
import type { IAppliedThemeOptions } from './types.js';
import { applyThemeClass, isThemeClassApplied, suppressTransitions } from './utilities.js';

/**
 * Applies a theme preference to the page: the `light` or `dark` class on `<html>`, following the
 * system's color scheme while the preference is `system`. The class changes before the browser
 * paints, with transitions off by default, so colors switch at once. Pair it with
 * createThemeInitScript, so the page shows the right theme before React loads, and set
 * `color-scheme` per class in your stylesheet.
 * @param preference The user's preference, such as from a settings store.
 * @param options Whether to turn transitions off while the class changes. Defaults to true.
 * @returns The theme applied, `light` or `dark`.
 * @example
 * import { useAppliedTheme } from 'jg-react';
 *
 * export const ThemeRoot = ({ preference }: { preference: 'light' | 'dark' | 'system' }) => {
 *   useAppliedTheme(preference);
 *   return null;
 * };
 */
export const useAppliedTheme = (
  preference: IThemePreference,
  { disableTransitionsOnChange = true }: IAppliedThemeOptions = {},
): IResolvedTheme => {
  const theme = useResolvedTheme(preference);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (isThemeClassApplied(root, theme)) {
      return;
    }
    const restoreTransitions = disableTransitionsOnChange
      ? suppressTransitions(document)
      : undefined;
    applyThemeClass(root, theme);
    restoreTransitions?.();
  }, [disableTransitionsOnChange, theme]);

  return theme;
};
