import type { IAppInstallationState, IServiceWorkerSnapshot } from '../shared/index.js';

// the state before anything happened, also what a server renders
const INITIAL_SNAPSHOT: IServiceWorkerSnapshot = Object.freeze({
  registration: undefined,
  worker: undefined,
  registrationError: undefined,
  hasWaitingWorker: false,
  installation: Object.freeze({
    canInstall: false,
    isAppInstalled: undefined,
    isRunningInstalledApp: false,
    promptOutcome: undefined,
  }),
});

// the current snapshot, replaced by a new object on every change
let snapshot: IServiceWorkerSnapshot = INITIAL_SNAPSHOT;

// the functions subscribeToServiceWorker registered
const listeners = new Set<() => void>();

// whether registerServiceWorker asked for logs
let isDebugMode = false;

/**
 * Turns the debug logs on or off.
 * @param debugMode Whether to log.
 */
export const setDebugMode = (debugMode: boolean): void => {
  isDebugMode = debugMode;
};

/**
 * Logs an event when debug mode is on.
 * @param message What happened.
 * @param details The values worth inspecting.
 */
export const log = (message: string, ...details: unknown[]): void => {
  if (isDebugMode) {
    console.log(`[jg-sw] ${message}`, ...details);
  }
};

/**
 * Updates the snapshot and notifies the listeners, but only when a value changes, so the snapshot
 * keeps its identity otherwise.
 * @param changes The snapshot fields to change.
 * @param installationChanges The installation fields to change.
 * @param force Replaces the snapshot even when the values are the same, for changes inside them,
 * such as a worker's state.
 */
export const updateSnapshot = (
  changes: Partial<Omit<IServiceWorkerSnapshot, 'installation'>>,
  installationChanges: Partial<IAppInstallationState> = {},
  force = false,
): void => {
  const isChanged = (current: object, next: object): boolean =>
    Object.entries(next).some(
      ([key, value]) => !Object.is((current as Record<string, unknown>)[key], value),
    );
  const isInstallationChanged = isChanged(snapshot.installation, installationChanges);
  if (!force && !isChanged(snapshot, changes) && !isInstallationChanged) {
    return;
  }
  snapshot = Object.freeze({
    ...snapshot,
    ...changes,
    installation: isInstallationChanged
      ? Object.freeze({ ...snapshot.installation, ...installationChanges })
      : snapshot.installation,
  });
  for (const listener of listeners) {
    listener();
  }
};

/**
 * Reads the service worker's state: its registration, its newest worker, whether an update waits,
 * and whether the app can be installed. The same object comes back until something changes, so
 * it can be passed to React's useSyncExternalStore, during server rendering too.
 * @returns The snapshot.
 * @example
 * import { getServiceWorkerSnapshot, subscribeToServiceWorker } from 'jg-sw';
 *
 * const { hasWaitingWorker, installation } = useSyncExternalStore(
 *   subscribeToServiceWorker,
 *   getServiceWorkerSnapshot,
 *   getServiceWorkerSnapshot,
 * );
 */
export const getServiceWorkerSnapshot = (): IServiceWorkerSnapshot => snapshot;

/**
 * Calls a listener whenever the snapshot changes, such as when an update finishes installing or
 * the app becomes installable.
 * @param listener The function to call, without arguments; read the new state with
 * getServiceWorkerSnapshot.
 * @returns A function that stops the calls.
 * @example
 * import { getServiceWorkerSnapshot, subscribeToServiceWorker } from 'jg-sw';
 *
 * const unsubscribe = subscribeToServiceWorker(() => {
 *   if (getServiceWorkerSnapshot().hasWaitingWorker) {
 *     showUpdateBanner();
 *   }
 * });
 */
export const subscribeToServiceWorker = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
