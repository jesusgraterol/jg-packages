import { Exception, extractMessage } from 'jg-exception';

import {
  ERRORS,
  type IBeforeInstallPromptEvent,
  type IInstallationPromptOutcome,
} from '../shared/index.js';
import { getServiceWorkerSnapshot, log, updateSnapshot } from '../state/index.js';

// the prompt event the browser fired last, until installApp uses it
let installationPrompt: IBeforeInstallPromptEvent | undefined;

// whether the listeners are attached, which happens once
let isListening = false;

/**
 * Checks whether a prompt event can show the installation prompt.
 * @param prompt The prompt event.
 * @returns Whether it has a prompt method.
 */
const canPrompt = (
  prompt: IBeforeInstallPromptEvent | undefined,
): prompt is IBeforeInstallPromptEvent =>
  prompt !== undefined && typeof prompt.prompt === 'function';

/**
 * Starts tracking whether the app can be installed: reads whether it already runs installed, and
 * keeps the browser's install prompt for installApp. It does nothing after the first call, or
 * outside a browser.
 */
export const listenForInstallation = (): void => {
  if (isListening || typeof window === 'undefined') {
    return;
  }
  isListening = true;
  const isRunningInstalledApp =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  updateSnapshot({}, { isRunningInstalledApp });

  window.addEventListener('beforeinstallprompt', (event) => {
    log('Event fired: beforeinstallprompt', event);
    // keeps the browser's own install banner from showing, so the app decides when to prompt
    event.preventDefault();
    installationPrompt = event;
    updateSnapshot({}, { canInstall: canInstallApp() });
  });

  window.addEventListener('appinstalled', () => {
    log('Event fired: appinstalled');
    installationPrompt = undefined;
    updateSnapshot({}, { canInstall: false, isAppInstalled: true });
  });
};

/**
 * Checks whether installApp can show the installation prompt now: the browser offered one, and
 * the page doesn't already run as the installed app. Only Chromium-based browsers offer it.
 * @returns Whether the app can be installed.
 * @example
 * installButton.hidden = !canInstallApp();
 */
export const canInstallApp = (): boolean =>
  canPrompt(installationPrompt) && !getServiceWorkerSnapshot().installation.isRunningInstalledApp;

/**
 * Shows the browser's installation prompt and resolves to the user's answer, also kept in the
 * snapshot as installation.promptOutcome. The browser offers each prompt once, so canInstallApp
 * is false afterwards until it offers another.
 * @returns A promise that resolves to 'accepted' or 'dismissed'.
 * @example
 * installButton.addEventListener('click', async () => {
 *   const outcome = await installApp(); // 'accepted' or 'dismissed'
 * });
 * @throws
 * - NO_APP_INSTALLER: The app can't be installed because the browser didn't offer the prompt.
 * - UNKNOWN_INSTALLATION_PROMPT_ERROR: The installation prompt failed.
 */
export const installApp = async (): Promise<IInstallationPromptOutcome> => {
  const prompt = installationPrompt;
  if (!canPrompt(prompt)) {
    throw new Exception(
      "The app can't be installed because the browser didn't offer the installation prompt.",
      ERRORS.NO_APP_INSTALLER,
    );
  }
  try {
    await prompt.prompt();
    const choice = await prompt.userChoice;
    log('Action fired: installApp', choice);
    installationPrompt = undefined;
    updateSnapshot({}, { canInstall: false, promptOutcome: choice.outcome });
    return choice.outcome;
  } catch (error) {
    throw new Exception(
      `The installation prompt failed: ${extractMessage(error)}`,
      ERRORS.UNKNOWN_INSTALLATION_PROMPT_ERROR,
    );
  }
};
