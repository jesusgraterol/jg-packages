import { useCallback, useEffect, useMemo } from 'react';
import type * as React from 'react';

import { useResolvedTheme } from 'jg-react';

import { type IAppTheme, type IResolvedAppTheme } from '../../contracts/index.js';

import {
  useUiPreferencesStore,
  useUiPreferencesStoreApi,
} from '../../shared/ui-preferences/index.js';
import { useUiPreferencesCapabilities } from '../ui-preferences-provider/index.js';
import { ThemeProviderContext } from './theme-provider.context.js';
import type { IThemeProviderProps } from './types.js';
import { disableTransitionsTemporarily, resolveTheme } from './utilities.js';

/**
 * Provides persisted theme state and applies the resolved theme class to the document root.
 * @param props The provider props that configure children and transition behavior.
 * @returns A React element that renders the theme context provider.
 * @example
 * import { createElement } from 'react';
 * import { ThemeProvider } from 'jg-react-ui/components/theme-provider';
 * const app = createElement(ThemeProvider, { children: 'App' });
 */
export const ThemeProvider = ({
  children,
  disableTransitionOnChange = true,
}: IThemeProviderProps): React.ReactElement => {
  const store = useUiPreferencesStoreApi();
  const theme = useUiPreferencesStore((state) => state.uiPreferences.theme);
  const { updatePreferences } = useUiPreferencesCapabilities();

  // jg-react follows the system color scheme while the preference is system
  const resolvedTheme = useResolvedTheme(theme);

  /**
   * Applies the resolved theme class to the document root.
   * @param nextResolvedTheme The concrete theme that should drive the next document class.
   */
  const applyTheme = useCallback(
    (nextResolvedTheme: IResolvedAppTheme): void => {
      // called only from the committed browser effect; server rendering never touches the root.
      const root = document.documentElement;
      if (
        root.classList.contains(nextResolvedTheme) &&
        !root.classList.contains(nextResolvedTheme === 'dark' ? 'light' : 'dark')
      ) {
        return;
      }
      const restoreTransitions = disableTransitionOnChange ? disableTransitionsTemporarily() : null;

      root.classList.remove('light', 'dark');
      root.classList.add(nextResolvedTheme);

      if (restoreTransitions) {
        restoreTransitions();
      }
    },
    [disableTransitionOnChange],
  );

  /**
   * Persists the selected theme and updates provider state.
   * @param nextTheme The next theme value selected by the consumer.
   */
  const setTheme = useCallback(
    (nextTheme: IAppTheme): void => {
      updatePreferences({ theme: nextTheme });
    },
    [updatePreferences],
  );

  useEffect(() => {
    // the preferences provider synchronizes storage in a layout effect before this effect runs.
    applyTheme(resolveTheme(store.getState().uiPreferences.theme));
  }, [applyTheme, resolvedTheme, store]);

  const themeProviderState = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [resolvedTheme, setTheme, theme],
  );

  return <ThemeProviderContext value={themeProviderState}>{children}</ThemeProviderContext>;
};
