import { SKIP_WAITING_MESSAGE_TYPE } from '../../shared/index.js';
import { UPDATE_INSTALL_TIMEOUT_SECONDS } from '../shared/index.js';
import { getServiceWorkerSnapshot, log } from '../state/index.js';

// the states of a worker that finished installing
const INSTALLED_STATES = new Set<ServiceWorkerState>(['installed', 'activating', 'activated']);

// whether the page is already reloading, so it reloads once
let isReloading = false;

// the update in progress, which concurrent calls share
let updatePromise: Promise<void> | undefined;

/**
 * Reloads the page, once.
 */
const reloadOnce = (): void => {
  if (isReloading) {
    return;
  }
  isReloading = true;
  log('Reloading the page');
  window.location.reload();
};

/**
 * Asks a waiting worker to activate, and reloads the page once it controls the page.
 * @param worker The waiting worker.
 */
const activateWaitingWorker = (worker: ServiceWorker): void => {
  navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });
  log('Activating the waiting worker', worker);
  worker.postMessage({ type: SKIP_WAITING_MESSAGE_TYPE });
};

/**
 * Waits for an installing worker to finish, for at most UPDATE_INSTALL_TIMEOUT_SECONDS.
 * @param worker The installing worker.
 * @returns A promise that resolves to whether it installed: false when it became redundant, such
 * as when its install handler failed, or when the time ran out.
 */
const waitForInstallation = (worker: ServiceWorker): Promise<boolean> =>
  new Promise((resolve) => {
    const settle = (isInstalled: boolean): void => {
      clearTimeout(timer);
      worker.removeEventListener('statechange', onStateChange);
      resolve(isInstalled);
    };
    const onStateChange = (): void => {
      if (worker.state === 'redundant') {
        settle(false);
      } else if (INSTALLED_STATES.has(worker.state)) {
        settle(true);
      }
    };
    const timer = setTimeout(() => {
      log('The new worker took too long to install');
      settle(false);
    }, UPDATE_INSTALL_TIMEOUT_SECONDS * 1000);
    worker.addEventListener('statechange', onStateChange);

    // the worker may have changed its state already
    onStateChange();
  });

/**
 * Activates the newest version of the app.
 * @returns A promise that resolves once the waiting worker was asked to activate, or the page
 * started reloading.
 */
const update = async (): Promise<void> => {
  const { registration } = getServiceWorkerSnapshot();
  if (registration === undefined) {
    reloadOnce();
    return;
  }
  if (registration.waiting === null) {
    try {
      // resolves once a new worker starts installing, not once it has installed
      await registration.update();
    } catch (error) {
      log('The update check failed', error);
    }
    if (registration.installing !== null) {
      await waitForInstallation(registration.installing);
    }
  }
  if (registration.waiting === null) {
    // nothing new was found, its installation failed, or it took too long
    reloadOnce();
    return;
  }
  activateWaitingWorker(registration.waiting);
};

/**
 * Updates the app to its newest version and reloads the page once, never in a loop. When a new
 * version waits, it activates it and reloads once the new worker controls the page. Otherwise, it
 * checks for one, waits up to UPDATE_INSTALL_TIMEOUT_SECONDS for it to install, then activates it
 * the same way. When nothing new is found, the installation fails, or the time runs out, it
 * reloads the page as it is.
 * @returns A promise that resolves once the new worker was asked to activate, or the page started
 * reloading.
 * @example
 * import { getServiceWorkerSnapshot, updateApp } from 'jg-sw';
 *
 * if (getServiceWorkerSnapshot().hasWaitingWorker) {
 *   updateButton.addEventListener('click', () => updateApp());
 * }
 */
export const updateApp = (): Promise<void> => {
  updatePromise ??= update().finally(() => {
    updatePromise = undefined;
  });
  return updatePromise;
};
