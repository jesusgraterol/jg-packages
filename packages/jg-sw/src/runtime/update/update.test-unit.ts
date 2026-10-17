import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  FakeRegistration,
  FakeServiceWorker,
  flushPromises,
  loadRuntime,
  stubBrowser,
} from '../fakes.test-utils.js';

/**
 * Registers a worker whose registration has an active worker, as after a first visit.
 * @returns The runtime and the fakes.
 */
const setUp = async () => {
  const registration = new FakeRegistration();
  const active = new FakeServiceWorker('activated');
  registration.active = active;
  const browser = stubBrowser(registration);
  browser.container.controller = active;
  const runtime = await loadRuntime();
  await runtime.registerServiceWorker();
  return { ...browser, ...runtime, active };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('updateApp', () => {
  test('a waiting worker: asks it to activate and reloads once when it takes control', async () => {
    const { registration, container, window, updateApp, SKIP_WAITING_MESSAGE_TYPE } = await setUp();
    registration.startInstalling();
    registration.finishInstalling();
    const waiting = registration.waiting!;

    await updateApp();
    expect(registration.update).not.toHaveBeenCalled();
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: SKIP_WAITING_MESSAGE_TYPE });
    expect(window.location.reload).not.toHaveBeenCalled();

    container.changeController(waiting);
    container.changeController(waiting);
    await updateApp();
    container.changeController(waiting);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('no waiting worker: waits for the one update() starts installing, then activates it', async () => {
    const { registration, container, window, updateApp, SKIP_WAITING_MESSAGE_TYPE } = await setUp();
    const installing = new FakeServiceWorker('installing');
    registration.update.mockImplementation(() => {
      registration.startInstalling(installing);
      return Promise.resolve();
    });

    const pending = updateApp();
    await flushPromises();
    expect(registration.update).toHaveBeenCalledOnce();
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(window.location.reload).not.toHaveBeenCalled();

    registration.finishInstalling();
    await pending;
    expect(installing.postMessage).toHaveBeenCalledWith({ type: SKIP_WAITING_MESSAGE_TYPE });
    expect(window.location.reload).not.toHaveBeenCalled();

    container.changeController(installing);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('a worker that installed before update() resolved: activates it right away', async () => {
    const { registration, updateApp, SKIP_WAITING_MESSAGE_TYPE } = await setUp();
    registration.update.mockImplementation(() => {
      registration.startInstalling();
      registration.finishInstalling();
      return Promise.resolve();
    });

    await updateApp();

    expect(registration.waiting!.postMessage).toHaveBeenCalledWith({
      type: SKIP_WAITING_MESSAGE_TYPE,
    });
  });

  test('a failed installation: reloads once without activating anything', async () => {
    const { registration, window, updateApp } = await setUp();
    const installing = new FakeServiceWorker('installing');
    registration.update.mockImplementation(() => {
      registration.startInstalling(installing);
      return Promise.resolve();
    });

    const pending = updateApp();
    await flushPromises();
    registration.failInstalling();
    await pending;

    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('an installation that takes too long: reloads once after UPDATE_INSTALL_TIMEOUT_SECONDS', async () => {
    vi.useFakeTimers();
    const { registration, window, updateApp, UPDATE_INSTALL_TIMEOUT_SECONDS } = await setUp();
    const installing = new FakeServiceWorker('installing');
    registration.update.mockImplementation(() => {
      registration.startInstalling(installing);
      return Promise.resolve();
    });

    const pending = updateApp();
    await vi.advanceTimersByTimeAsync(UPDATE_INSTALL_TIMEOUT_SECONDS * 1000 - 1);
    expect(window.location.reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(window.location.reload).toHaveBeenCalledOnce();

    // the worker finishing later changes nothing
    registration.finishInstalling();
    expect(installing.postMessage).not.toHaveBeenCalled();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('nothing new: reloads once', async () => {
    const { registration, window, updateApp } = await setUp();

    await updateApp();

    expect(registration.update).toHaveBeenCalledOnce();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('a failed update check: reloads once', async () => {
    const { registration, window, updateApp } = await setUp();
    registration.update.mockRejectedValue(new Error('offline'));

    await updateApp();

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('no registration: reloads once', async () => {
    const { window } = stubBrowser();
    const { updateApp } = await loadRuntime();

    await updateApp();

    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('concurrent calls share one update and one reload', async () => {
    const { registration, window, updateApp } = await setUp();

    await Promise.all([updateApp(), updateApp(), updateApp()]);

    expect(registration.update).toHaveBeenCalledOnce();
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  test('a controller change without updateApp, such as the first worker claiming the page, never reloads', async () => {
    const { container, window, active } = await setUp();

    container.changeController(active);
    container.changeController(new FakeServiceWorker('activated'));

    expect(window.location.reload).not.toHaveBeenCalled();
  });
});
