import { useSyncExternalStore } from 'react';

import {
  getServerVisibilitySnapshot,
  getVisibilitySnapshot,
  subscribeToVisibility,
} from './utilities.js';

/**
 * Reports whether the page is visible, re-rendering when its tab is hidden or shown again, such as
 * to pause polling while nobody looks. A server render reports visible.
 * @returns Whether the page is visible.
 * @example
 * import { useEffect } from 'react';
 * import { useDocumentVisibility } from 'jg-react';
 *
 * declare const refreshPrices: () => void;
 *
 * export const usePricePolling = (): void => {
 *   const isVisible = useDocumentVisibility();
 *   useEffect(() => {
 *     if (!isVisible) {
 *       return undefined;
 *     }
 *     const timer = setInterval(refreshPrices, 30_000);
 *     return () => clearInterval(timer);
 *   }, [isVisible]);
 * };
 */
export const useDocumentVisibility = (): boolean =>
  useSyncExternalStore(subscribeToVisibility, getVisibilitySnapshot, getServerVisibilitySnapshot);
