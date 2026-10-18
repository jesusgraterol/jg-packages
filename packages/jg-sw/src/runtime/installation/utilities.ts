// the user agent of an iPhone, an iPad, or an iPod touch
const IOS_DEVICE_USER_AGENT = /iPhone|iPad|iPod/;

// a navigator as Safari on iOS has it, with the flag a Home Screen app sets
type IStandaloneNavigator = Navigator & { standalone?: unknown };

/**
 * Checks whether the page runs as an installed app: in a standalone display, or, in Safari on iOS,
 * opened from the Home Screen, which `navigator.standalone` reports.
 * @returns Whether it does.
 */
export const isStandaloneDisplay = (): boolean =>
  (typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && (navigator as IStandaloneNavigator).standalone === true);

/**
 * Checks whether the page runs in a browser tab on an iPhone, an iPad, or an iPod touch, rather
 * than as an app installed to the Home Screen. There, web push and some storage only work once the
 * app is installed, and no browser offers an install prompt, so this decides when to show your own
 * Add to Home Screen instructions. An iPad that asks for desktop sites reports a Mac, so a Mac with
 * a touchscreen counts as one.
 * @returns Whether it's an iOS browser tab; `false` outside a browser.
 * @example
 * import { isIosBrowserTab } from 'jg-sw';
 *
 * homeScreenHint.hidden = !isIosBrowserTab();
 */
export const isIosBrowserTab = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const isIosDevice =
    IOS_DEVICE_USER_AGENT.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIosDevice && !isStandaloneDisplay();
};
