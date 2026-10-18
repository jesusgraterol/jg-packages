import { useSyncExternalStore } from 'react';

import {
  getOnlineSnapshot,
  getServerOnlineSnapshot,
  subscribeToOnlineStatus,
} from './utilities.js';

/**
 * Reports whether the browser is online, re-rendering when it goes online or offline. It's the
 * browser's own guess, from its network interfaces, not proof that a server can be reached, so
 * use it to explain a failure, not to skip a request. A server render reports online.
 * @returns Whether the browser is online.
 * @example
 * import { useOnlineStatus } from 'jg-react';
 *
 * export const OfflineBanner = () => {
 *   const isOnline = useOnlineStatus();
 *   return isOnline ? null : 'You are offline. Changes will sync when you reconnect.';
 * };
 */
export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(subscribeToOnlineStatus, getOnlineSnapshot, getServerOnlineSnapshot);
