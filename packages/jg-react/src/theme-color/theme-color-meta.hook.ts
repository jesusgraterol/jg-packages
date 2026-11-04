import { useEffect } from 'react';

import { useDocumentTheme } from '../theme/index.js';

import type { IThemeColors } from './types.js';

/**
 * Keeps the browser's chrome, and an installed app's title bar, on the theme the page shows: it
 * sets every `<meta name="theme-color">` tag to the theme's color whenever `<html>`'s theme
 * changes, as useAppliedTheme and createThemeInitScript write it. Keep `media` queries off those
 * tags, or start them with the system's colors, since the page's theme decides from then on.
 * @param colors The color for each theme.
 * @example
 * import { useThemeColorMeta } from 'jg-react';
 *
 * const THEME_COLORS = { light: '#fefdfb', dark: '#1e2939' };
 *
 * export const useAppThemeColor = (): void => useThemeColorMeta(THEME_COLORS);
 */
export const useThemeColorMeta = ({ light, dark }: IThemeColors): void => {
  const theme = useDocumentTheme();
  const color = theme === 'dark' ? dark : light;
  useEffect(() => {
    for (const tag of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      tag.content = color;
    }
  }, [color]);
};
