import { Exception, isException } from 'jg-exception';

import { toPng } from '../copy/image.js';
import {
  ERRORS,
  getSecureClipboard,
  toClipboardException,
  unsupported,
  type IClipboardContent,
} from '../shared/index.js';

/**
 * Reads the text on the clipboard. Browsers ask before a page reads it: Safari and Firefox show a
 * paste prompt, and Chromium asks for the clipboard-read permission once. Call it from a click or
 * key press handler, which Safari requires.
 * @returns A promise that resolves to the text, or `''` when the clipboard holds none.
 * @example
 * pasteButton.addEventListener('click', async () => {
 *   input.value = await readText();
 * });
 * @throws
 * - CLIPBOARD_UNSUPPORTED: The clipboard can't read text here.
 * - CLIPBOARD_NOT_FOCUSED: The page must have focus to use the clipboard.
 * - CLIPBOARD_NO_USER_GESTURE: The browser only allows this right after a click or a key press.
 * - CLIPBOARD_PERMISSION_DENIED: The permission to use the clipboard was denied.
 * - CLIPBOARD_READ_FAILED: The clipboard couldn't be read.
 */
export const readText = async (): Promise<string> => {
  const clipboard = getSecureClipboard();
  const read = clipboard?.readText;
  if (typeof read !== 'function') {
    throw unsupported('read text');
  }
  try {
    return await read.call(clipboard);
  } catch (error) {
    throw await toClipboardException(error, 'read');
  }
};

/**
 * Reads one type from the first item that has it.
 * @param items The clipboard's items.
 * @param type The MIME type.
 * @returns A promise that resolves to the item's text, or null when no item has the type.
 */
const readType = async (items: ClipboardItems, type: string): Promise<string | null> => {
  const item = items.find(({ types }) => types.includes(type));
  return item === undefined ? null : (await item.getType(type)).text();
};

/**
 * Reads the first image, preferring PNG, as PNG.
 * @param items The clipboard's items.
 * @returns A promise that resolves to the PNG, or null when no item holds an image.
 */
const readImage = async (items: ClipboardItems): Promise<Blob | null> => {
  const types = items.flatMap((item) => item.types.map((type) => ({ item, type })));
  const image =
    types.find(({ type }) => type === 'image/png') ??
    types.find(({ type }) => type.startsWith('image/'));
  return image === undefined ? null : toPng(await image.item.getType(image.type));
};

/**
 * Reads the clipboard's text, HTML, and image with one `read()` call, so the person pasting sees
 * one prompt at most. Call it from a click or key press handler, which Safari requires.
 * @returns A promise that resolves to each kind of content, with null for the kinds the clipboard
 * doesn't hold. The image is PNG.
 * @example
 * pasteButton.addEventListener('click', async () => {
 *   const { html, text, image } = await readClipboard();
 *   if (image) {
 *     preview.src = URL.createObjectURL(image);
 *   }
 * });
 * @throws
 * - CLIPBOARD_UNSUPPORTED: The clipboard can't read here.
 * - CLIPBOARD_NOT_FOCUSED: The page must have focus to use the clipboard.
 * - CLIPBOARD_NO_USER_GESTURE: The browser only allows this right after a click or a key press.
 * - CLIPBOARD_PERMISSION_DENIED: The permission to use the clipboard was denied.
 * - CLIPBOARD_INVALID_IMAGE: The image couldn't be decoded, so it can't be copied as PNG.
 * - CLIPBOARD_READ_FAILED: The clipboard couldn't be read.
 */
export const readClipboard = async (): Promise<IClipboardContent> => {
  const clipboard = getSecureClipboard();
  const read = clipboard?.read;
  if (typeof read !== 'function') {
    throw unsupported('read');
  }
  let items: ClipboardItems;
  try {
    items = await read.call(clipboard);
  } catch (error) {
    throw await toClipboardException(error, 'read');
  }
  try {
    const [text, html, image] = await Promise.all([
      readType(items, 'text/plain'),
      readType(items, 'text/html'),
      readImage(items),
    ]);
    return { text, html, image };
  } catch (error) {
    throw isException(error)
      ? error
      : new Exception("The clipboard's content couldn't be read.", {
          code: ERRORS.CLIPBOARD_READ_FAILED,
          cause: error,
        });
  }
};
