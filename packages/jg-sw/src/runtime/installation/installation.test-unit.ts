import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import {
  createInstallPromptEvent,
  type IFakeDevice,
  loadRuntime,
  stubBrowser,
} from '../fakes.test-utils.js';

// the navigators of the devices Moldea tells apart
const IPHONE: IFakeDevice = {
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
};
const DESKTOP_MODE_IPAD: IFakeDevice = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 5,
};
const DESKTOP: IFakeDevice = {
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  platform: 'MacIntel',
  maxTouchPoints: 0,
};

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

describe('isIosBrowserTab', () => {
  test.each([
    ['an iPhone tab', false, IPHONE, true],
    ['an iPhone app opened from the Home Screen', false, { ...IPHONE, standalone: true }, false],
    ['an iPad tab that asks for desktop sites', false, DESKTOP_MODE_IPAD, true],
    ['an installed iPad that asks for desktop sites', true, DESKTOP_MODE_IPAD, false],
    ['a desktop browser', false, DESKTOP, false],
  ])('isIosBrowserTab() in %s', async (_, isStandalone, device, expected) => {
    stubBrowser(undefined, isStandalone, device);
    const { isIosBrowserTab } = await loadRuntime();

    expect(isIosBrowserTab()).toBe(expected);
  });

  test('is false outside a browser', async () => {
    stubBrowser(undefined, false, IPHONE);
    vi.stubGlobal('window', undefined);
    const { isIosBrowserTab } = await loadRuntime();

    expect(isIosBrowserTab()).toBe(false);
  });

  test('is false without a navigator', async () => {
    stubBrowser(undefined, false, IPHONE);
    vi.stubGlobal('navigator', undefined);
    const { isIosBrowserTab } = await loadRuntime();

    expect(isIosBrowserTab()).toBe(false);
  });
});

describe('running as the installed app', () => {
  test("counts Safari's Home Screen app, which reports navigator.standalone only", async () => {
    stubBrowser(undefined, false, { ...IPHONE, standalone: true });
    const { registerServiceWorker, getServiceWorkerSnapshot } = await loadRuntime();

    await registerServiceWorker();

    expect(getServiceWorkerSnapshot().installation.isRunningInstalledApp).toBe(true);
  });
});
