import { hasErrorCode, isException } from 'jg-exception';
import { describe, expect, test, vi } from 'vitest';

import {
  createInstallPromptEvent,
  FakeRegistration,
  FakeServiceWorker,
  flushPromises,
  loadRuntime,
  stubBrowser,
} from '../fakes.test-utils.js';

describe('registerServiceWorker', () => {
  test('touches neither window nor navigator when the module loads', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('navigator', undefined);

    const { getServiceWorkerSnapshot, canInstallApp } = await loadRuntime();

    expect(getServiceWorkerSnapshot().registration).toBeUndefined();
    expect(canInstallApp()).toBe(false);
  });

  test('reports SW_NO_BROWSER_SUPPORT without rejecting when the browser has no service workers', async () => {
    stubBrowser();
    vi.stubGlobal('navigator', {});
    const { registerServiceWorker, ERRORS } = await loadRuntime();

    const snapshot = await registerServiceWorker();

    expect(snapshot.registration).toBeUndefined();
    expect(hasErrorCode(snapshot.registrationError, ERRORS.SW_NO_BROWSER_SUPPORT)).toBe(true);
  });

  test('registers /sw.js with the root scope once, however many times it is called', async () => {
    const registration = new FakeRegistration();
    registration.active = new FakeServiceWorker('activated');
    const { container } = stubBrowser(registration);
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();

    const first = registerServiceWorker();
    const second = registerServiceWorker({ path: '/other.js' });
    expect(second).toBe(first);

    const snapshot = await first;
    expect(container.register).toHaveBeenCalledOnce();
    expect(container.register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
    expect(snapshot).toBe(getServiceWorkerSnapshot());
    expect(snapshot.registration).toBe(registration);
    expect(snapshot.worker).toBe(registration.active);
    expect(snapshot.hasWaitingWorker).toBe(false);
    expect(snapshot.registrationError).toBeUndefined();
  });

  test('passes a custom path and options to the browser', async () => {
    const registration = new FakeRegistration();
    registration.installing = new FakeServiceWorker('installing');
    const { container } = stubBrowser(registration);
    const { registerServiceWorker } = await loadRuntime();

    await registerServiceWorker({ path: '/app/sw.js', options: { scope: '/app/' } });

    expect(container.register).toHaveBeenCalledWith('/app/sw.js', { scope: '/app/' });
  });

  test('reports a failed registration without rejecting', async () => {
    const { container } = stubBrowser();
    container.register.mockRejectedValue(new Error('The script has an unsupported MIME type.'));
    const { registerServiceWorker } = await loadRuntime();

    const snapshot = await registerServiceWorker();

    expect(snapshot.registration).toBeUndefined();
    expect(isException(snapshot.registrationError)).toBe(true);
    expect(snapshot.registrationError).toMatchObject({
      code: 'SW_REGISTRATION_FAILED',
      message: "The Service Worker couldn't be registered.",
      cause: new Error('The script has an unsupported MIME type.'),
    });
  });

  test('reports EMPTY_SW_REGISTRATION for a registration without workers', async () => {
    stubBrowser(new FakeRegistration());
    const { registerServiceWorker, ERRORS } = await loadRuntime();

    const snapshot = await registerServiceWorker();

    expect(hasErrorCode(snapshot.registrationError, ERRORS.EMPTY_SW_REGISTRATION)).toBe(true);
  });

  test('listens for the install prompt before the registration settles, even when it fails', async () => {
    const { container, window } = stubBrowser();
    let rejectRegistration!: (error: Error) => void;
    container.register.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRegistration = reject;
      }),
    );
    const { registerServiceWorker, canInstallApp, getServiceWorkerSnapshot } = await loadRuntime();

    const pending = registerServiceWorker();
    window.dispatchEvent(createInstallPromptEvent().event);
    expect(canInstallApp()).toBe(true);

    rejectRegistration(new Error('offline'));
    await pending;
    expect(getServiceWorkerSnapshot().installation.canInstall).toBe(true);
  });

  test('follows new workers, their state, and the controller into new snapshots', async () => {
    const registration = new FakeRegistration();
    const active = new FakeServiceWorker('activated');
    registration.active = active;
    const { container } = stubBrowser(registration);
    const { registerServiceWorker, getServiceWorkerSnapshot, subscribeToServiceWorker } =
      await loadRuntime();
    await registerServiceWorker();
    const listener = vi.fn();
    subscribeToServiceWorker(listener);

    const installing = registration.startInstalling();
    const afterUpdateFound = getServiceWorkerSnapshot();
    expect(afterUpdateFound.worker).toBe(installing);
    expect(afterUpdateFound.hasWaitingWorker).toBe(false);

    registration.finishInstalling();
    const afterInstall = getServiceWorkerSnapshot();
    expect(afterInstall).not.toBe(afterUpdateFound);
    expect(afterInstall.worker).toBe(installing);
    expect(afterInstall.hasWaitingWorker).toBe(true);

    registration.waiting = null;
    registration.active = installing;
    installing.setState('activated');
    container.changeController(installing);
    expect(getServiceWorkerSnapshot().hasWaitingWorker).toBe(false);
    expect(getServiceWorkerSnapshot().worker).toBe(installing);
    expect(listener).toHaveBeenCalledTimes(4);

    // a worker's state change replaces the snapshot even when the workers stay the same
    const beforeStateChange = getServiceWorkerSnapshot();
    active.setState('redundant');
    expect(getServiceWorkerSnapshot()).not.toBe(beforeStateChange);
  });

  test('logs only in debug mode', async () => {
    const registration = new FakeRegistration();
    registration.active = new FakeServiceWorker('activated');
    stubBrowser(registration);
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await (await loadRuntime()).registerServiceWorker();
    await flushPromises();
    expect(consoleLog).not.toHaveBeenCalled();

    await (await loadRuntime()).registerServiceWorker({ debugMode: true });
    expect(consoleLog).toHaveBeenCalledWith('[jg-sw] Registered the service worker', registration);
    consoleLog.mockRestore();
  });

  test('reports no worker once the registration has none left', async () => {
    const registration = new FakeRegistration();
    registration.active = new FakeServiceWorker('activated');
    const { container } = stubBrowser(registration);
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    await registerServiceWorker();

    registration.active = null;
    container.changeController(null);

    expect(getServiceWorkerSnapshot().worker).toBeUndefined();
    expect(getServiceWorkerSnapshot().registration).toBe(registration);
  });
});
