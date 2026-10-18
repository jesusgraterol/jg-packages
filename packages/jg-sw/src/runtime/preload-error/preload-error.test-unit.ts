import { describe, expect, test, vi } from 'vitest';

import {
  createPreloadErrorEvent,
  FakeRegistration,
  FakeServiceWorker,
  loadRuntime,
  stubBrowser,
  stubDocument,
  stubOnline,
} from '../fakes.test-utils.js';

/**
 * Stubs a browser that registers an active worker, online, on a page built by Vite.
 * @returns The fake window.
 */
const stubApp = () => {
  const registration = new FakeRegistration();
  registration.active = new FakeServiceWorker('activated');
  const browser = stubBrowser(registration);
  stubOnline(true);
  stubDocument();
  return browser;
};

// the cases Moldea's preload error recovery is tested with
describe('vite:preloadError', () => {
  test("records an online failure of the page's build, without reloading", async () => {
    const { window } = stubApp();
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    await registerServiceWorker();
    const preloadError = createPreloadErrorEvent();

    window.dispatchEvent(preloadError);

    expect(preloadError.defaultPrevented).toBe(true);
    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(true);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  test('handles every repeated failure, and notifies the listeners once', async () => {
    const { window } = stubApp();
    const { registerServiceWorker, subscribeToServiceWorker } = await loadRuntime();
    await registerServiceWorker();
    const listener = vi.fn();
    subscribeToServiceWorker(listener);
    const firstError = createPreloadErrorEvent();
    const repeatedError = createPreloadErrorEvent();

    window.dispatchEvent(firstError);
    window.dispatchEvent(repeatedError);

    expect(firstError.defaultPrevented).toBe(true);
    expect(repeatedError.defaultPrevented).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
  });

  test('keeps an early failure in the snapshot for a later reader', async () => {
    const { window } = stubApp();
    const { registerServiceWorker, getServiceWorkerSnapshot, subscribeToServiceWorker } =
      await loadRuntime();
    const registration = registerServiceWorker();

    // the failure arrives before the registration settles
    window.dispatchEvent(createPreloadErrorEvent());
    await registration;
    const listener = vi.fn();
    subscribeToServiceWorker(listener);

    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  test("leaves an offline failure to Vite and the app's own error handling", async () => {
    const { window } = stubApp();
    stubOnline(false);
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    await registerServiceWorker();
    const preloadError = createPreloadErrorEvent();

    window.dispatchEvent(preloadError);

    expect(preloadError.defaultPrevented).toBe(false);
    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(false);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  test.each([
    ['without an entry module', null],
    ['whose entry module has an empty src', '  '],
  ])('leaves a failure alone on a page %s, whose build is unknown', async (_, entrySource) => {
    const { window } = stubApp();
    stubDocument(entrySource);
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    await registerServiceWorker();
    const preloadError = createPreloadErrorEvent();

    window.dispatchEvent(preloadError);

    expect(preloadError.defaultPrevented).toBe(false);
    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(false);
  });

  test('handles failures in a browser without service workers too', async () => {
    const { window } = stubApp();
    vi.stubGlobal('navigator', { onLine: true });
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    await registerServiceWorker();
    const preloadError = createPreloadErrorEvent();

    window.dispatchEvent(preloadError);

    expect(getServiceWorkerSnapshot().registrationError).toBeDefined();
    expect(preloadError.defaultPrevented).toBe(true);
    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(true);
  });

  test('leaves failures alone until registerServiceWorker is called, and listens once', async () => {
    const { window } = stubApp();
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();
    const early = createPreloadErrorEvent();

    window.dispatchEvent(early);
    await registerServiceWorker();
    await registerServiceWorker();

    expect(early.defaultPrevented).toBe(false);
    expect(getServiceWorkerSnapshot().preloadErrorDetected).toBe(false);
    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'vite:preloadError'),
    ).toHaveLength(1);
  });

  test('loads the new version only through updateApp', async () => {
    const { window } = stubApp();
    const { registerServiceWorker, updateApp } = await loadRuntime();
    await registerServiceWorker();

    window.dispatchEvent(createPreloadErrorEvent());
    expect(window.location.reload).not.toHaveBeenCalled();

    await updateApp();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
