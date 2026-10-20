import type { IResolvedTheme } from 'jg-site';

import { DARK_COLOR_SCHEME_QUERY, NO_TRANSITIONS_STYLE } from './constants.js';

/**
 * Reads the system's dark color scheme media query, when the browser has matchMedia.
 * @returns The media query list, or `undefined` outside a browser.
 */
const getDarkSchemeQuery = (): MediaQueryList | undefined =>
  typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? undefined
    : window.matchMedia(DARK_COLOR_SCHEME_QUERY);

/**
 * Reads whether the system uses a dark color scheme, as useSyncExternalStore's snapshot.
 * @returns Whether it does; `false` without matchMedia.
 */
export const getSystemDarkSchemeSnapshot = (): boolean => getDarkSchemeQuery()?.matches ?? false;

/**
 * Calls a listener whenever the system's color scheme changes, as useSyncExternalStore's
 * subscription.
 * @param onChange The listener.
 * @returns The function that stops listening.
 */
export const subscribeToSystemDarkScheme = (onChange: () => void): (() => void) => {
  const query = getDarkSchemeQuery();
  query?.addEventListener('change', onChange);
  return () => {
    query?.removeEventListener('change', onChange);
  };
};

/**
 * Subscribes to nothing, for a preference that doesn't follow the system.
 * @returns The function that stops listening, which does nothing.
 */
export const subscribeToNothing = (): (() => void) => () => undefined;

/**
 * Checks whether an element's classes already show a theme: its class, and not the other one.
 * @param root The element, such as `document.documentElement`.
 * @param theme The theme.
 * @returns Whether it does.
 */
export const isThemeClassApplied = (root: Element, theme: IResolvedTheme): boolean =>
  root.classList.contains(theme) && !root.classList.contains(theme === 'dark' ? 'light' : 'dark');

/**
 * Sets an element's theme class, removing the other one.
 * @param root The element, such as `document.documentElement`.
 * @param theme The theme.
 */
export const applyThemeClass = (root: Element, theme: IResolvedTheme): void => {
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

/**
 * Turns every transition off until the next paints, so a theme change doesn't animate colors.
 * Call it before changing the theme class, then call the function it returns.
 * @param target The document.
 * @returns The function that forces a style recalculation, then removes the style after two
 * animation frames.
 */
export const suppressTransitions = (target: Document): (() => void) => {
  const style = target.createElement('style');
  style.appendChild(target.createTextNode(NO_TRANSITIONS_STYLE));
  target.head.appendChild(style);
  return () => {
    const view = target.defaultView;
    if (view === null) {
      style.remove();
      return;
    }
    // reading a computed style applies the change while transitions are off
    view.getComputedStyle(target.body);
    view.requestAnimationFrame(() => {
      view.requestAnimationFrame(() => {
        style.remove();
      });
    });
  };
};

/**
 * Reads the theme the page shows from `<html>`'s class, as useAppliedTheme and
 * createThemeInitScript write it: `dark` wins, then `light`, then the system's color scheme.
 * @returns `light` or `dark`.
 */
export const readDocumentTheme = (): IResolvedTheme => {
  const { classList } = document.documentElement;
  if (classList.contains('dark')) {
    return 'dark';
  }
  if (classList.contains('light')) {
    return 'light';
  }
  return getSystemDarkSchemeSnapshot() ? 'dark' : 'light';
};

/**
 * Calls a listener whenever `<html>`'s class or the system's color scheme changes, as
 * useSyncExternalStore's subscription.
 * @param onChange The listener.
 * @returns The function that stops listening.
 */
export const subscribeToDocumentTheme = (onChange: () => void): (() => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  const unsubscribeFromSystem = subscribeToSystemDarkScheme(onChange);
  return () => {
    observer.disconnect();
    unsubscribeFromSystem();
  };
};
