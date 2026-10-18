// types
export type {
  IAppInstallationState,
  IBeforeInstallPromptEvent,
  IInstallationPromptOutcome,
  IRegisterServiceWorkerOptions,
  IServiceWorkerSnapshot,
  IUserChoice,
} from './shared/index.js';

// constants
export {
  DEFAULT_SERVICE_WORKER_PATH,
  DEFAULT_SERVICE_WORKER_SCOPE,
  SKIP_WAITING_MESSAGE_TYPE,
} from '../shared/index.js';
export { REGISTRATION_DURATION_SECONDS, UPDATE_INSTALL_TIMEOUT_SECONDS } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// state
export { getServiceWorkerSnapshot, subscribeToServiceWorker } from './state/index.js';

// registration
export { registerServiceWorker } from './registration/index.js';

// updates
export { updateApp } from './update/index.js';

// installation
export { canInstallApp, installApp, isIosBrowserTab } from './installation/index.js';
