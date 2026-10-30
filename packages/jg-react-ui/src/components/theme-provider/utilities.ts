import type { IAppTheme, IResolvedAppTheme } from '../../contracts/index.js';

import { COLOR_SCHEME_QUERY } from './constants.js';

/**
 * Checks whether browser-only theme APIs are available.
 * @returns True when window and document are available.
 */
export const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Resolves the current system color scheme.
 * @returns The resolved system theme, defaulting to light outside the browser.
 */
const getSystemTheme = (): IResolvedAppTheme => {
  if (!isBrowser() || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
};

/**
 * Temporarily disables transitions while the root theme class changes.
 * @returns A cleanup function that restores transitions after the next paint.
 */
export const disableTransitionsTemporarily = (): (() => void) => {
  const style = document.createElement('style');
  style.appendChild(
    document.createTextNode(
      '*,*::before,*::after{-webkit-transition:none!important;transition:none!important}',
    ),
  );
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        style.remove();
      });
    });
  };
};

/**
 * Resolves a concrete light or dark theme from the selected theme value.
 * @param theme The selected theme value.
 * @returns The concrete theme that should be applied to the document.
 */
export const resolveTheme = (theme: IAppTheme): IResolvedAppTheme =>
  theme === 'system' ? getSystemTheme() : theme;
