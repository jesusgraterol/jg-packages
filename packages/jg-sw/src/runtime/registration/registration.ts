import { encodeError, extractMessage } from 'jg-exception';

import { DEFAULT_SERVICE_WORKER_PATH, DEFAULT_SERVICE_WORKER_SCOPE } from '../../shared/index.js';
import { listenForInstallation } from '../installation/index.js';
import {
  ERRORS,
  type IRegisterServiceWorkerOptions,
  type IServiceWorkerSnapshot,
} from '../shared/index.js';
import { getServiceWorkerSnapshot, log, setDebugMode, updateSnapshot } from '../state/index.js';

// the first call's registration, which later calls return
let registrationPromise: Promise<IServiceWorkerSnapshot> | undefined;

// the workers whose state changes are followed
const trackedWorkers = new WeakSet<ServiceWorker>();

/**
 * Copies the registration's workers into the snapshot.
 * @param registration The registration.
 * @param force Replaces the snapshot even when the workers are the same, because their state
 * changed.
 */
const syncRegistration = (registration: ServiceWorkerRegistration, force = false): void => {
  updateSnapshot(
    {
      registration,
      worker: registration.installing ?? registration.waiting ?? registration.active ?? undefined,
      hasWaitingWorker: registration.waiting !== null,
    },
    {},
    force,
  );
};

/**
 * Follows a worker's state changes, once per worker.
 * @param registration The registration the worker belongs to.
 * @param worker The worker, or null when the registration has none in that position.
 */
const trackWorker = (
  registration: ServiceWorkerRegistration,
  worker: ServiceWorker | null,
): void => {
  if (worker === null || trackedWorkers.has(worker)) {
    return;
  }
  trackedWorkers.add(worker);
  worker.addEventListener('statechange', () => {
    log('Event fired: statechange', worker.state);
    syncRegistration(registration, true);
  });
};

/**
 * Registers the worker and follows its updates.
 * @param options The registration options.
 * @returns A promise that resolves to the snapshot once the registration settles.
 */
const register = async ({
  path = DEFAULT_SERVICE_WORKER_PATH,
  options = { scope: DEFAULT_SERVICE_WORKER_SCOPE },
  debugMode = false,
}: IRegisterServiceWorkerOptions): Promise<IServiceWorkerSnapshot> => {
  setDebugMode(debugMode);

  // the install prompt can fire before the registration settles, or without one
  listenForInstallation();

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    updateSnapshot({
      registrationError: encodeError(
        'The browser does not support Service Workers.',
        ERRORS.SW_NO_BROWSER_SUPPORT,
      ),
    });
    return getServiceWorkerSnapshot();
  }

  try {
    const registration = await navigator.serviceWorker.register(path, options);
    log('Registered the service worker', registration);
    if (!registration.installing && !registration.waiting && !registration.active) {
      updateSnapshot({
        registrationError: encodeError(
          "The Service Worker's registration is empty.",
          ERRORS.EMPTY_SW_REGISTRATION,
        ),
      });
      return getServiceWorkerSnapshot();
    }
    trackWorker(registration, registration.installing);
    trackWorker(registration, registration.waiting);
    trackWorker(registration, registration.active);
    registration.addEventListener('updatefound', () => {
      log('Event fired: updatefound', registration.installing);
      trackWorker(registration, registration.installing);
      syncRegistration(registration, true);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      log('Event fired: controllerchange', navigator.serviceWorker.controller);
      syncRegistration(registration, true);
    });
    syncRegistration(registration);
  } catch (error) {
    log('The registration failed', error);
    updateSnapshot({ registrationError: extractMessage(error) });
  }
  return getServiceWorkerSnapshot();
};

/**
 * Registers the service worker and starts following its updates and whether the app can be
 * installed. Later calls return the first call's promise. It never rejects: a failure lands in the
 * snapshot's registrationError, with SW_NO_BROWSER_SUPPORT or EMPTY_SW_REGISTRATION as its code
 * when it has one.
 * @param options The worker's path and registration options, and whether to log.
 * @returns A promise that resolves to the snapshot once the registration settles.
 * @example
 * const { registration, registrationError } = await registerServiceWorker();
 * if (hasErrorCode(registrationError, ERRORS.SW_NO_BROWSER_SUPPORT)) {
 *   // the browser has no service workers
 * }
 */
export const registerServiceWorker = (
  options: IRegisterServiceWorkerOptions = {},
): Promise<IServiceWorkerSnapshot> => {
  registrationPromise ??= register(options);
  return registrationPromise;
};
