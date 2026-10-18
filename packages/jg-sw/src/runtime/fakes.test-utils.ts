import { vi } from 'vitest';

import type { IInstallationPromptOutcome } from './shared/index.js';

// a ServiceWorker whose state the test moves forward
export class FakeServiceWorker extends EventTarget {
  state: ServiceWorkerState;
  readonly postMessage = vi.fn();

  constructor(state: ServiceWorkerState) {
    super();
    this.state = state;
  }

  // changes the state and fires statechange, as the browser does
  setState(state: ServiceWorkerState): void {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

// a ServiceWorkerRegistration whose workers the test moves between positions
export class FakeRegistration extends EventTarget {
  installing: FakeServiceWorker | null = null;
  waiting: FakeServiceWorker | null = null;
  active: FakeServiceWorker | null = null;
  readonly update = vi.fn((): Promise<void> => Promise.resolve());

  // a new worker starts installing, as after update() finds one
  startInstalling(worker = new FakeServiceWorker('installing')): FakeServiceWorker {
    this.installing = worker;
    this.dispatchEvent(new Event('updatefound'));
    return worker;
  }

  // the installing worker installs and waits, because an older one is active
  finishInstalling(): void {
    const worker = this.installing;
    if (worker === null) {
      throw new Error('No worker is installing.');
    }
    this.installing = null;
    this.waiting = worker;
    worker.setState('installed');
  }

  // the installing worker fails to install
  failInstalling(): void {
    const worker = this.installing;
    if (worker === null) {
      throw new Error('No worker is installing.');
    }
    this.installing = null;
    worker.setState('redundant');
  }
}

// navigator.serviceWorker, resolving register() with the registration
export class FakeServiceWorkerContainer extends EventTarget {
  controller: FakeServiceWorker | null = null;
  readonly register = vi.fn<(path: string, options?: RegistrationOptions) => Promise<unknown>>();

  constructor(registration: FakeRegistration) {
    super();
    this.register.mockResolvedValue(registration);
  }

  // a new worker takes control of the page
  changeController(worker: FakeServiceWorker | null): void {
    this.controller = worker;
    this.dispatchEvent(new Event('controllerchange'));
  }
}

// the window fields the runtime reads
export type IFakeWindow = EventTarget & {
  location: { reload: ReturnType<typeof vi.fn> };
  matchMedia: ReturnType<typeof vi.fn>;
};

// the navigator fields that tell a device apart, as an iPhone or a desktop browser reports them
export type IFakeDevice = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
};

/**
 * Stubs window and navigator.serviceWorker for one test.
 * @param registration The registration register() resolves to.
 * @param isStandalone Whether the page runs in a standalone display.
 * @param device The navigator fields of the device, such as its user agent.
 * @returns The fake container and window.
 */
export const stubBrowser = (
  registration = new FakeRegistration(),
  isStandalone = false,
  device: IFakeDevice = {},
): {
  container: FakeServiceWorkerContainer;
  window: IFakeWindow;
  registration: FakeRegistration;
} => {
  const container = new FakeServiceWorkerContainer(registration);
  const fakeWindow = Object.assign(new EventTarget(), {
    location: { reload: vi.fn() },
    matchMedia: vi.fn(() => ({ matches: isStandalone })),
  });
  vi.stubGlobal('navigator', { serviceWorker: container, ...device });
  vi.stubGlobal('window', fakeWindow);
  return { container, window: fakeWindow, registration };
};

/**
 * Stubs the document with the entry module a Vite build adds to the page.
 * @param entrySource The entry module's src attribute, or null for a page without one.
 */
export const stubDocument = (entrySource: string | null = '/assets/index-old.js'): void => {
  vi.stubGlobal('document', {
    querySelector: vi.fn((selector: string) =>
      selector === 'script[type="module"][src]' && entrySource !== null
        ? { getAttribute: (name: string) => (name === 'src' ? entrySource : null) }
        : null,
    ),
  });
};

/**
 * Sets whether the browser reports being online, on the navigator stubBrowser stubbed.
 * @param isOnline Whether it's online.
 */
export const stubOnline = (isOnline: boolean): void => {
  Object.assign(navigator, { onLine: isOnline });
};

/**
 * Builds the event Vite fires when a chunk of the build fails to load.
 * @returns The event, which can be canceled as Vite's is.
 */
export const createPreloadErrorEvent = (): Event =>
  new Event('vite:preloadError', { cancelable: true });

/**
 * Builds the beforeinstallprompt event Chromium fires.
 * @param outcome The user's answer to the prompt.
 * @returns The event and its prompt method.
 */
export const createInstallPromptEvent = (outcome: IInstallationPromptOutcome = 'accepted') => {
  const prompt = vi.fn((): Promise<void> => Promise.resolve());
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    platforms: ['web'],
    userChoice: Promise.resolve({ outcome, platform: 'web' }),
    prompt,
  });
  return { event, prompt };
};

/**
 * Imports the runtime with fresh module state.
 * @returns A promise that resolves to the runtime's exports.
 */
export const loadRuntime = async () => {
  vi.resetModules();
  return import('./index.js');
};

/**
 * Lets pending promise callbacks run.
 * @returns A promise that resolves after the queued microtasks and one macrotask.
 */
export const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
