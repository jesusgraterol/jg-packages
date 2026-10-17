import { Exception } from 'jg-exception';

import { browserGlobals, ERRORS } from '../shared/index.js';

/**
 * Builds the error for an image that can't be written as PNG.
 * @param cause The decoding or drawing error, if any.
 * @returns The CLIPBOARD_INVALID_IMAGE error.
 */
const invalidImage = (cause?: unknown): Exception =>
  new Exception("The image couldn't be decoded, so it can't be copied as PNG.", {
    code: ERRORS.CLIPBOARD_INVALID_IMAGE,
    cause,
  });

/**
 * Draws a decoded image on a canvas and exports it as PNG, on an OffscreenCanvas where the browser
 * has one, and on a page canvas otherwise.
 * @param bitmap The decoded image.
 * @returns A promise that resolves to the PNG.
 */
const drawAsPng = async (bitmap: ImageBitmap): Promise<Blob> => {
  const { OffscreenCanvas: Offscreen } = browserGlobals;
  if (typeof Offscreen === 'function') {
    const canvas = new Offscreen(bitmap.width, bitmap.height);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('The canvas produced no PNG.'));
      } else {
        resolve(blob);
      }
    }, 'image/png');
  });
};

/**
 * Turns an image into PNG, the only image type browsers accept on the clipboard. A PNG is kept as it
 * is, and anything else is decoded and redrawn.
 * @param image The image, or a promise of it.
 * @returns The PNG, or a promise of it.
 * @throws
 * - CLIPBOARD_INVALID_IMAGE: The image couldn't be decoded, so it can't be copied as PNG.
 */
export const toPng = (image: Blob | Promise<Blob>): Blob | Promise<Blob> => {
  if (image instanceof Blob && image.type === 'image/png') {
    return image;
  }
  return Promise.resolve(image).then(async (blob) => {
    if (!(blob instanceof Blob)) {
      throw invalidImage();
    }
    if (blob.type === 'image/png') {
      return blob;
    }
    if (typeof browserGlobals.createImageBitmap !== 'function') {
      throw invalidImage();
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await browserGlobals.createImageBitmap(blob);
    } catch (error) {
      throw invalidImage(error);
    }
    try {
      return await drawAsPng(bitmap);
    } catch (error) {
      throw invalidImage(error);
    } finally {
      bitmap.close();
    }
  });
};
