import { useCallback, useSyncExternalStore } from 'react';

import { getScrollY, subscribeToScroll } from './utilities.js';

/**
 * Reports whether the window is scrolled past a number of pixels, such as to shadow a sticky
 * header or show a back-to-top button. It re-renders only when the answer changes, not on every
 * scroll. A server render reports false.
 * @param pixels How far down the window must be scrolled, in pixels.
 * @returns Whether it's scrolled further than that.
 * @example
 * import { useIsWindowScrolledPast } from 'jg-react';
 *
 * export const useHeaderShadow = (): string =>
 *   useIsWindowScrolledPast(8) ? 'shadow-md' : 'shadow-none';
 */
export const useIsWindowScrolledPast = (pixels: number): boolean => {
  const getSnapshot = useCallback((): boolean => getScrollY() > pixels, [pixels]);
  return useSyncExternalStore(subscribeToScroll, getSnapshot, () => false);
};
