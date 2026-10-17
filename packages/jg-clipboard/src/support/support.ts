import {
  browserGlobals,
  getSecureClipboard,
  supportsItemType,
  type IClipboardSupport,
} from '../shared/index.js';

// what a page without a usable clipboard can do
const NO_SUPPORT: IClipboardSupport = {
  isSecureContext: false,
  copyText: false,
  copyHtml: false,
  copyImage: false,
  readText: false,
  read: false,
};

/**
 * Tells what the browser lets the page do with the clipboard, from feature detection and
 * `ClipboardItem.supports` where the browser has it. It never throws, and it's safe to call during
 * server rendering, where everything is false. A supported feature can still be refused, such as
 * without a click or a permission.
 * @returns Whether the page is a secure context, and whether each function can run.
 * @example
 * const support = getClipboardSupport();
 * if (support.copyImage) {
 *   showCopyImageButton();
 * }
 */
export const getClipboardSupport = (): IClipboardSupport => {
  try {
    const clipboard = getSecureClipboard();
    const canWriteItems =
      typeof clipboard?.write === 'function' && typeof browserGlobals.ClipboardItem === 'function';
    return {
      isSecureContext: browserGlobals.isSecureContext === true,
      copyText:
        typeof clipboard?.writeText === 'function' ||
        (canWriteItems && supportsItemType('text/plain')),
      copyHtml: canWriteItems && supportsItemType('text/html'),
      copyImage: canWriteItems && supportsItemType('image/png'),
      readText: typeof clipboard?.readText === 'function',
      read: typeof clipboard?.read === 'function',
    };
  } catch {
    // a browser can throw while its features are read, such as a blocked frame
    return { ...NO_SUPPORT };
  }
};
