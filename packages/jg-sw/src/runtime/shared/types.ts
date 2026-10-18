import type { Exception } from 'jg-exception';

// the options registerServiceWorker accepts
export type IRegisterServiceWorkerOptions = {
  // the worker's script. Defaults to DEFAULT_SERVICE_WORKER_PATH, '/sw.js'
  path?: string;

  // the options passed to navigator.serviceWorker.register. Defaults to { scope: '/' }
  options?: RegistrationOptions;

  // logs the registration, update, and installation events to the console
  debugMode?: boolean;
};

// the action the user took on the installation prompt
export type IInstallationPromptOutcome = 'accepted' | 'dismissed';

// the user's answer to the installation prompt
export type IUserChoice = {
  outcome: IInstallationPromptOutcome;
  platform: string;
};

// the event Chromium-based browsers fire when the app can be installed, which lets the app show
// the installation prompt when it chooses
export interface IBeforeInstallPromptEvent extends Event {
  // the platforms the event was dispatched for, such as 'web' or 'play'
  readonly platforms: string[];

  // resolves to the user's answer once the prompt closes
  readonly userChoice: Promise<IUserChoice>;

  // shows the installation prompt
  prompt(): Promise<void>;
}

// the beforeinstallprompt event, which TypeScript's DOM types don't declare yet
declare global {
  interface WindowEventMap {
    beforeinstallprompt: IBeforeInstallPromptEvent;
  }
}

// whether the app can be installed, and what happened when it was offered
export type IAppInstallationState = {
  // whether installApp can show the installation prompt now
  canInstall: boolean;

  // true once the browser reports the app was installed, undefined until then
  isAppInstalled: boolean | undefined;

  // whether the page runs as the installed app, in a standalone window
  isRunningInstalledApp: boolean;

  // the user's answer to the last prompt installApp showed, undefined until one is answered
  promptOutcome: IInstallationPromptOutcome | undefined;
};

// the service worker's state. The object keeps its identity until something changes, so
// useSyncExternalStore(subscribeToServiceWorker, getServiceWorkerSnapshot) re-renders only on
// changes
export type IServiceWorkerSnapshot = {
  // the registration, once registerServiceWorker succeeds
  registration: ServiceWorkerRegistration | undefined;

  // the newest worker: the installing one, else the waiting one, else the active one
  worker: ServiceWorker | undefined;

  // why the registration failed, with one of the ERRORS codes
  registrationError: Exception | undefined;

  // whether a new version is installed and waits to activate, which updateApp does
  hasWaitingWorker: boolean;

  // whether a chunk of the page's build failed to load while online, most likely because a newer
  // deployment replaced it; updateApp loads the new version
  preloadErrorDetected: boolean;

  // whether the app can be installed, and what happened when it was offered
  installation: IAppInstallationState;
};
