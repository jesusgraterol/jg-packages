/**
 * Subscribes to the browser going online or offline.
 * @param notify Called on every change.
 * @returns The unsubscribe function.
 */
export const subscribeToOnlineStatus = (notify: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
};

/**
 * Reads whether the browser thinks it's online. Without a navigator that says, it's online.
 * @returns Whether it's online.
 */
export const getOnlineSnapshot = (): boolean =>
  typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' || navigator.onLine;

/**
 * The online status a server renders: online, since a server can't tell.
 * @returns Always true.
 */
export const getServerOnlineSnapshot = (): boolean => true;
