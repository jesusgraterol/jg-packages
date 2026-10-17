import { REDUCED_MOTION_QUERY } from './constants.js';

// a view whose reduced-motion preference can be read, such as a window
type IMediaQueryView = { matchMedia?: (query: string) => { matches: boolean } };

/*
 * The browser globals the checks read. The package runs in browsers and Node.js, so they're read
 * from globalThis without assuming they exist.
 */
type IEnvironmentGlobals = { window?: IMediaQueryView; indexedDB?: unknown };

// the global object, typed with the browser globals that may be missing
const environmentGlobals = globalThis as IEnvironmentGlobals;

/**
 * Checks whether a global window object exists. It reports presence only and doesn't identify a
 * browser.
 * @returns True when the window global is defined.
 * @example
 * import { hasWindow } from 'jg-utilities';
 *
 * hasWindow(); // true in a browser, false in Node.js
 */
export const hasWindow = (): boolean => typeof environmentGlobals.window !== 'undefined';

/**
 * Checks whether a global navigator object exists. It reports presence only and doesn't identify a
 * browser: Node.js 21 and later define a global navigator too.
 * @returns True when the navigator global is defined.
 * @example
 * import { hasNavigator } from 'jg-utilities';
 *
 * hasNavigator(); // true in browsers and in Node.js 21 or later
 */
export const hasNavigator = (): boolean => typeof navigator !== 'undefined';

/**
 * Checks whether the IndexedDB API exists in the current environment.
 * @returns True when the indexedDB global is defined.
 * @example
 * import { isIndexedDbAvailable } from 'jg-utilities';
 *
 * isIndexedDbAvailable(); // true in browsers that support IndexedDB
 */
export const isIndexedDbAvailable = (): boolean =>
  typeof environmentGlobals.indexedDB !== 'undefined';

/**
 * Checks whether the user asked the system to reduce motion. The view defaults to the global
 * window when one exists; pass another one, such as an element's ownerDocument.defaultView, to
 * check a different window.
 * @param view? The window whose media query is read. Defaults to the global window.
 * @returns True only when the view reports a reduced-motion preference.
 * @example
 * import { prefersReducedMotion } from 'jg-utilities';
 *
 * prefersReducedMotion(); // true when the user asked the system to reduce motion
 */
export const prefersReducedMotion = (
  view: IMediaQueryView | null = environmentGlobals.window ?? null,
): boolean =>
  typeof view?.matchMedia === 'function' && view.matchMedia(REDUCED_MOTION_QUERY).matches;
