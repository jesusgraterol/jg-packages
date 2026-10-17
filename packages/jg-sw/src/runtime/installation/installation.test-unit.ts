import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { createInstallPromptEvent, loadRuntime, stubBrowser } from '../fakes.test-utils.js';

/**
 * Registers the worker, which starts listening for the install prompt.
 * @param isStandalone Whether the page runs as the installed app.
 * @returns The runtime and the fake window.
 */
const setUp = async (isStandalone = false) => {
  const browser = stubBrowser(undefined, isStandalone);
  const runtime = await loadRuntime();
  await runtime.registerServiceWorker();
  return { ...browser, ...runtime };
};

describe('installApp', () => {
  test('shows the prompt the browser offered and resolves to the answer', async () => {
    const { window, canInstallApp, installApp, getServiceWorkerSnapshot } = await setUp();
    expect(canInstallApp()).toBe(false);

    const { event, prompt } = createInstallPromptEvent('accepted');
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(canInstallApp()).toBe(true);
    expect(getServiceWorkerSnapshot().installation.canInstall).toBe(true);

    await expect(installApp()).resolves.toBe('accepted');
    expect(prompt).toHaveBeenCalledOnce();
    expect(getServiceWorkerSnapshot().installation).toStrictEqual({
      canInstall: false,
      isAppInstalled: undefined,
      isRunningInstalledApp: false,
      promptOutcome: 'accepted',
    });
    expect(canInstallApp()).toBe(false);
  });

  test('keeps a dismissed answer, and offers the next prompt the browser fires', async () => {
    const { window, canInstallApp, installApp, getServiceWorkerSnapshot } = await setUp();
    window.dispatchEvent(createInstallPromptEvent('dismissed').event);

    await expect(installApp()).resolves.toBe('dismissed');
    expect(getServiceWorkerSnapshot().installation.promptOutcome).toBe('dismissed');

    window.dispatchEvent(createInstallPromptEvent('accepted').event);
    expect(canInstallApp()).toBe(true);
  });

  test('throws NO_APP_INSTALLER when the browser offered no prompt', async () => {
    const { installApp, ERRORS } = await setUp();

    await expectToRejectCode(installApp(), ERRORS.NO_APP_INSTALLER);
  });

  test('throws UNKNOWN_INSTALLATION_PROMPT_ERROR when the prompt fails', async () => {
    const { window, installApp, ERRORS } = await setUp();
    const { event, prompt } = createInstallPromptEvent();
    prompt.mockRejectedValue(new Error('The prompt was already shown.'));
    window.dispatchEvent(event);

    await expectToRejectCode(
      installApp(),
      ERRORS.UNKNOWN_INSTALLATION_PROMPT_ERROR,
      'The prompt was already shown.',
    );
  });

  test('never offers installation inside the installed app', async () => {
    const { window, canInstallApp, getServiceWorkerSnapshot } = await setUp(true);
    window.dispatchEvent(createInstallPromptEvent().event);

    expect(getServiceWorkerSnapshot().installation.isRunningInstalledApp).toBe(true);
    expect(canInstallApp()).toBe(false);
    expect(getServiceWorkerSnapshot().installation.canInstall).toBe(false);
  });

  test('records that the app was installed', async () => {
    const { window, canInstallApp, getServiceWorkerSnapshot } = await setUp();
    window.dispatchEvent(createInstallPromptEvent().event);

    window.dispatchEvent(new Event('appinstalled'));

    expect(canInstallApp()).toBe(false);
    expect(getServiceWorkerSnapshot().installation).toMatchObject({
      canInstall: false,
      isAppInstalled: true,
    });
  });
});

describe('installation outside a browser', () => {
  test('tracks nothing without a window, such as in a worker', async () => {
    stubBrowser();
    vi.stubGlobal('window', undefined);
    const { registerServiceWorker, canInstallApp } = await loadRuntime();

    await registerServiceWorker();

    expect(canInstallApp()).toBe(false);
  });
});
