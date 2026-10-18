import { describe, expect, test, vi } from 'vitest';

import { loadRuntime } from '../fakes.test-utils.js';

/**
 * Imports the state module with fresh module state.
 * @returns A promise that resolves to the state module.
 */
const loadState = async () => {
  await loadRuntime();
  return import('./state.js');
};

describe('getServiceWorkerSnapshot', () => {
  test('starts empty and keeps its identity until something changes', async () => {
    const { getServiceWorkerSnapshot, updateSnapshot } = await loadState();
    const initial = getServiceWorkerSnapshot();

    expect(initial).toStrictEqual({
      registration: undefined,
      worker: undefined,
      registrationError: undefined,
      hasWaitingWorker: false,
      preloadErrorDetected: false,
      installation: {
        canInstall: false,
        isAppInstalled: undefined,
        isRunningInstalledApp: false,
        promptOutcome: undefined,
      },
    });
    expect(Object.isFrozen(initial)).toBe(true);
    expect(getServiceWorkerSnapshot()).toBe(initial);

    updateSnapshot({ hasWaitingWorker: false }, { canInstall: false });
    expect(getServiceWorkerSnapshot()).toBe(initial);

    updateSnapshot({ hasWaitingWorker: true });
    const changed = getServiceWorkerSnapshot();
    expect(changed).not.toBe(initial);
    expect(changed.hasWaitingWorker).toBe(true);
    expect(changed.installation).toBe(initial.installation);

    updateSnapshot({}, { canInstall: true });
    expect(getServiceWorkerSnapshot()).not.toBe(changed);
    expect(getServiceWorkerSnapshot().installation).not.toBe(initial.installation);
    expect(getServiceWorkerSnapshot().installation.canInstall).toBe(true);

    const beforeForce = getServiceWorkerSnapshot();
    updateSnapshot({}, {}, true);
    expect(getServiceWorkerSnapshot()).not.toBe(beforeForce);
    expect(getServiceWorkerSnapshot()).toStrictEqual(beforeForce);
  });
});

describe('subscribeToServiceWorker', () => {
  test('calls its listeners on every change until they unsubscribe', async () => {
    const { subscribeToServiceWorker, updateSnapshot } = await loadState();
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToServiceWorker(first);
    subscribeToServiceWorker(second);

    updateSnapshot({ hasWaitingWorker: true });
    updateSnapshot({ hasWaitingWorker: true });
    expect(first).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith();
    expect(second).toHaveBeenCalledOnce();

    unsubscribeFirst();
    updateSnapshot({ hasWaitingWorker: false });
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe('log', () => {
  test('logs only in debug mode', async () => {
    const { log, setDebugMode } = await loadState();
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    log('quiet');
    expect(consoleLog).not.toHaveBeenCalled();

    setDebugMode(true);
    log('loud', 1);
    expect(consoleLog).toHaveBeenCalledWith('[jg-sw] loud', 1);
    consoleLog.mockRestore();
  });
});
