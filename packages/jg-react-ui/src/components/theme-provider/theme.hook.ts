import { useContext } from 'react';

import { Exception } from 'jg-exception';

import { ERRORS } from '../../errors/index.js';

import { ThemeProviderContext } from './theme-provider.context.js';
import type { IThemeProviderState } from './types.js';

/**
 * Reads the current theme context from the nearest theme provider.
 * @returns The current selected and resolved theme state.
 * @example
 * import { useTheme } from 'jg-react-ui/components/theme-provider';
 * const ResolvedTheme = () => useTheme().resolvedTheme;
 * @throws
 * - THEME_PROVIDER_MISSING: useTheme must be used within a ThemeProvider
 */
export const useTheme = (): IThemeProviderState => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Exception('useTheme must be used within a ThemeProvider', {
      code: ERRORS.THEME_PROVIDER_MISSING,
    });
  }

  return context;
};
