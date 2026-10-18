import { log, updateSnapshot } from '../state/index.js';

// the page's entry module, whose presence shows which build the page loaded
const ENTRY_MODULE_SELECTOR = 'script[type="module"][src]';

// whether the listener is attached, which happens once
let isListening = false;

/**
 * Checks whether the page loaded a build's entry module, so a chunk that fails to load comes
 * from a build a newer deployment replaced.
 * @returns Whether the entry module is there, with a source.
 */
const hasEntryModule = (): boolean =>
  typeof document !== 'undefined' &&
  (document.querySelector(ENTRY_MODULE_SELECTOR)?.getAttribute('src')?.trim() ?? '') !== '';

/**
 * Starts handling the chunk-load failures Vite reports with `vite:preloadError`, as Moldea does:
 * when the browser is online and the page loaded a build's entry module, the chunk most likely
 * went away with a newer deployment, so the event's default, Vite throwing the error, is
 * prevented, and the snapshot's preloadErrorDetected becomes true for the app to offer
 * updateApp. Any other failure, such as one while offline, is left to Vite and the app's own
 * error handling. It does nothing after the first call, or outside a browser.
 */
export const listenForPreloadErrors = (): void => {
  if (isListening || typeof window === 'undefined') {
    return;
  }
  isListening = true;
  window.addEventListener('vite:preloadError', (event: Event) => {
    log('Event fired: vite:preloadError', event);
    if (!navigator.onLine || !hasEntryModule()) {
      return;
    }
    event.preventDefault();
    updateSnapshot({ preloadErrorDetected: true });
  });
};
