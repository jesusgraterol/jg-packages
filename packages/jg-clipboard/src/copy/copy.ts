import { Exception, isException } from 'jg-exception';

import {
  browserGlobals,
  ERRORS,
  getSecureClipboard,
  supportsItemType,
  toClipboardException,
  unsupported,
  type ICopyHtmlOptions,
} from '../shared/index.js';
import { toPng } from './image.js';

/**
 * Turns text into a Blob of a type, keeping a promise a promise, so a ClipboardItem can wait for it.
 * @param value The text, or a promise of it.
 * @param type The MIME type.
 * @returns The Blob, or a promise of it.
 */
const toBlob = (value: string | Promise<string>, type: string): Blob | Promise<Blob> =>
  typeof value === 'string'
    ? new Blob([value], { type })
    : value.then((text) => new Blob([text], { type }));

/**
 * Reads the text an HTML fragment shows, for the plain text that goes with it.
 * @param html The HTML.
 * @returns Its text content.
 */
const htmlToText = (html: string): string => {
  const Parser = browserGlobals.DOMParser;
  return Parser === undefined
    ? ''
    : (new Parser().parseFromString(html, 'text/html').body.textContent ?? '');
};

/**
 * Waits for a clipboard write that already started, and names its failure. Content that already
 * failed, such as a rejected promise or an image that can't be converted, explains a failure better
 * than the browser's error. Content still loading is never waited for, so a refused write fails at
 * once.
 * @param write The write, started before the caller's first await.
 * @param content The content the write waits for, such as the caller's promises.
 * @returns A promise that resolves once the content is on the clipboard.
 * @throws
 * - CLIPBOARD_INVALID_IMAGE: The image couldn't be decoded, so it can't be copied as PNG.
 * - CLIPBOARD_WRITE_FAILED: The content couldn't be copied to the clipboard.
 * - CLIPBOARD_PERMISSION_DENIED, CLIPBOARD_NO_USER_GESTURE, or CLIPBOARD_NOT_FOCUSED, for a write
 * the browser refused.
 */
const settleWrite = async (
  write: Promise<void>,
  content: (Blob | Promise<Blob>)[] = [],
): Promise<void> => {
  // the handlers also keep a rejection that comes after the browser stopped waiting handled
  const failures: { reason: unknown }[] = [];
  for (const part of content) {
    Promise.resolve(part).catch((reason: unknown) => {
      failures.push({ reason });
    });
  }
  try {
    await write;
  } catch (error) {
    const [failure] = failures;
    if (failure !== undefined) {
      throw isException(failure.reason)
        ? failure.reason
        : new Exception("The content to copy couldn't be loaded.", {
            code: ERRORS.CLIPBOARD_WRITE_FAILED,
            cause: failure.reason,
          });
    }
    throw await toClipboardException(error, 'write');
  }
};

/**
 * Writes one ClipboardItem. Call it before the caller's first await, so the browser still sees the
 * click or key press that started the copy, and only after supportsItemType confirmed the types,
 * which also confirms ClipboardItem exists.
 * @param clipboard The clipboard.
 * @param item Each type with its content.
 * @returns A promise that resolves once the content is on the clipboard.
 */
const writeItem = (
  clipboard: Pick<Clipboard, 'write'>,
  item: Record<string, Blob | Promise<Blob>>,
): Promise<void> => {
  const ClipboardItemClass = browserGlobals.ClipboardItem as NonNullable<
    typeof browserGlobals.ClipboardItem
  >;
  return settleWrite(clipboard.write([new ClipboardItemClass(item)]), Object.values(item));
};

/**
 * Copies text to the clipboard. Call it from a click or key press handler. It calls the clipboard
 * before its first await, so the browser still sees that gesture. Text that loads after the click,
 * such as from a request, can be a promise: it goes through a ClipboardItem that waits for it, which
 * Safari needs. Browsers without ClipboardItem wait for the promise first, and may then refuse the
 * copy.
 * @param text The text, or a promise of it.
 * @returns A promise that resolves once the text is on the clipboard.
 * @example
 * button.addEventListener('click', () => {
 *   void copyText('npm install jg-clipboard');
 * });
 * @example
 * // the text loads after the click
 * button.addEventListener('click', () => {
 *   void copyText(fetch('/share-link').then((response) => response.text()));
 * });
 * @throws
 * - CLIPBOARD_UNSUPPORTED: The clipboard can't copy text here.
 * - CLIPBOARD_NOT_FOCUSED: The page must have focus to use the clipboard.
 * - CLIPBOARD_NO_USER_GESTURE: The browser only allows this right after a click or a key press.
 * - CLIPBOARD_PERMISSION_DENIED: The permission to use the clipboard was denied.
 * - CLIPBOARD_WRITE_FAILED: The content couldn't be copied to the clipboard.
 */
export const copyText = async (text: string | Promise<string>): Promise<void> => {
  const clipboard = getSecureClipboard();
  const write = clipboard?.write;
  const writeText = clipboard?.writeText;
  const canWriteItems = typeof write === 'function' && supportsItemType('text/plain');
  if (typeof text === 'string' && typeof writeText === 'function') {
    return settleWrite(writeText.call(clipboard, text));
  }
  if (canWriteItems) {
    return writeItem(
      { write: write.bind(clipboard) },
      { 'text/plain': toBlob(text, 'text/plain') },
    );
  }
  if (typeof writeText !== 'function') {
    throw unsupported('copy text');
  }
  // without ClipboardItem, the text must load before the clipboard call
  let loaded: string;
  try {
    loaded = await text;
  } catch (error) {
    throw new Exception("The content to copy couldn't be loaded.", {
      code: ERRORS.CLIPBOARD_WRITE_FAILED,
      cause: error,
    });
  }
  return settleWrite(writeText.call(clipboard, loaded));
};

/**
 * Copies HTML to the clipboard, with plain text for places that can't paste HTML: `options.text`,
 * or else the HTML's text content. Call it from a click or key press handler; like copyText, it
 * calls the clipboard before its first await, and either value can be a promise.
 * @param html The HTML, or a promise of it.
 * @param options The plain text that goes with it.
 * @returns A promise that resolves once the HTML is on the clipboard.
 * @example
 * button.addEventListener('click', () => {
 *   void copyHtml('<strong>Order #42</strong> shipped', { text: 'Order #42 shipped' });
 * });
 * @throws
 * - CLIPBOARD_UNSUPPORTED: The clipboard can't copy HTML here.
 * - CLIPBOARD_NOT_FOCUSED: The page must have focus to use the clipboard.
 * - CLIPBOARD_NO_USER_GESTURE: The browser only allows this right after a click or a key press.
 * - CLIPBOARD_PERMISSION_DENIED: The permission to use the clipboard was denied.
 * - CLIPBOARD_WRITE_FAILED: The content couldn't be copied to the clipboard.
 */
export const copyHtml = async (
  html: string | Promise<string>,
  options: ICopyHtmlOptions = {},
): Promise<void> => {
  const clipboard = getSecureClipboard();
  const write = clipboard?.write;
  if (typeof write !== 'function' || !supportsItemType('text/html')) {
    throw unsupported('copy HTML');
  }
  const text =
    options.text ?? (typeof html === 'string' ? htmlToText(html) : html.then(htmlToText));
  return writeItem(
    { write: write.bind(clipboard) },
    {
      'text/html': toBlob(html, 'text/html'),
      'text/plain': toBlob(text, 'text/plain'),
    },
  );
};

/**
 * Copies an image to the clipboard as PNG, the only image type browsers accept there. A PNG is
 * written as it is, and other types the browser can decode, such as JPEG or WebP, are redrawn as
 * PNG. Call it from a click or key press handler; it calls the clipboard before its first await, and
 * the image can be a promise, such as a fetched Blob.
 * @param image The image, or a promise of it.
 * @returns A promise that resolves once the image is on the clipboard.
 * @example
 * button.addEventListener('click', () => {
 *   void copyImage(fetch('/chart.png').then((response) => response.blob()));
 * });
 * @throws
 * - CLIPBOARD_UNSUPPORTED: The clipboard can't copy images here.
 * - CLIPBOARD_INVALID_IMAGE: The image couldn't be decoded, so it can't be copied as PNG.
 * - CLIPBOARD_NOT_FOCUSED: The page must have focus to use the clipboard.
 * - CLIPBOARD_NO_USER_GESTURE: The browser only allows this right after a click or a key press.
 * - CLIPBOARD_PERMISSION_DENIED: The permission to use the clipboard was denied.
 * - CLIPBOARD_WRITE_FAILED: The content couldn't be copied to the clipboard.
 */
export const copyImage = async (image: Blob | Promise<Blob>): Promise<void> => {
  const clipboard = getSecureClipboard();
  const write = clipboard?.write;
  if (typeof write !== 'function' || !supportsItemType('image/png')) {
    throw unsupported('copy images');
  }
  return writeItem({ write: write.bind(clipboard) }, { 'image/png': toPng(image) });
};
