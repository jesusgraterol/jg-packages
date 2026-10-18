/**
 * Subscribes to the page becoming visible or hidden, such as when the tab changes.
 * @param notify Called on every change.
 * @returns The unsubscribe function.
 */
export const subscribeToVisibility = (notify: () => void): (() => void) => {
  if (typeof document === 'undefined') {
    return () => undefined;
  }
  document.addEventListener('visibilitychange', notify);
  return () => {
    document.removeEventListener('visibilitychange', notify);
  };
};

/**
 * Reads whether the page is visible. Without a document, it is.
 * @returns Whether it's visible.
 */
export const getVisibilitySnapshot = (): boolean =>
  typeof document === 'undefined' || document.visibilityState === 'visible';

/**
 * The visibility a server renders: visible, so a page never renders hidden content first.
 * @returns Always true.
 */
export const getServerVisibilitySnapshot = (): boolean => true;
