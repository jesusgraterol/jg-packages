import { useSyncExternalStore } from 'react';

import { SYNTAX_HIGHLIGHT_COLOR_SCHEME_QUERY } from './constants.js';
import type { IResolvedSyntaxHighlightTheme } from './types.js';

/**
 * Checks whether browser document APIs are available for theme resolution.
 * @returns True when syntax highlighting can read browser theme state.
 */
const canReadSyntaxHighlightTheme = (): boolean =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * Resolves the active syntax highlighting theme from the document class or system preference.
 * @returns The light or dark theme used for syntax highlighting.
 */
export const resolveSyntaxHighlightTheme = (): IResolvedSyntaxHighlightTheme => {
  if (!canReadSyntaxHighlightTheme()) {
    return 'light';
  }

  if (document.documentElement.classList.contains('dark')) {
    return 'dark';
  }

  if (document.documentElement.classList.contains('light')) {
    return 'light';
  }

  if (typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(SYNTAX_HIGHLIGHT_COLOR_SCHEME_QUERY).matches ? 'dark' : 'light';
};

/** Subscribes to the document and system sources that determine syntax colors. */
const subscribeToSyntaxHighlightTheme = (notifyThemeChange: () => void): (() => void) => {
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia(SYNTAX_HIGHLIGHT_COLOR_SCHEME_QUERY)
      : null;
  const mutationObserver =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(notifyThemeChange);
  mutationObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  mediaQuery?.addEventListener('change', notifyThemeChange);
  return () => {
    mutationObserver?.disconnect();
    mediaQuery?.removeEventListener('change', notifyThemeChange);
  };
};

// hydration starts with the server palette, then React reconciles the document's actual theme.
const getServerSyntaxHighlightTheme = (): IResolvedSyntaxHighlightTheme => 'light';

/**
 * Tracks syntax colors with a hydration-safe snapshot of the document and system theme.
 * @returns The resolved syntax highlighting theme for the current browser environment.
 */
export const useResolvedSyntaxHighlightTheme = (): IResolvedSyntaxHighlightTheme =>
  useSyncExternalStore(
    subscribeToSyntaxHighlightTheme,
    resolveSyntaxHighlightTheme,
    getServerSyntaxHighlightTheme,
  );
