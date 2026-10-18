// a scroll listener never delays scrolling to call preventDefault
const SCROLL_LISTENER_OPTIONS: AddEventListenerOptions = { passive: true };

/**
 * Subscribes to the window scrolling.
 * @param notify Called on every scroll.
 * @returns The unsubscribe function.
 */
export const subscribeToScroll = (notify: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener('scroll', notify, SCROLL_LISTENER_OPTIONS);
  return () => {
    window.removeEventListener('scroll', notify, SCROLL_LISTENER_OPTIONS);
  };
};

/**
 * Reads how far the window is scrolled down. Without a window, it's at the top.
 * @returns The vertical scroll, in pixels.
 */
export const getScrollY = (): number => (typeof window === 'undefined' ? 0 : window.scrollY);
