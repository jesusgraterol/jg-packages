import type { Page } from 'playwright';

import type { IRequiredRenderFont } from './types.js';

/**
 * Loads the declared font faces and decodes images with native browser promises.
 * @param page The page with the prepared HTML.
 * @param requiredFonts The required font face descriptors.
 * @returns A safe error reason when a font or image is missing or broken.
 */
export const waitForAssets = (
  page: Page,
  requiredFonts: IRequiredRenderFont[],
): Promise<'font' | 'image' | undefined> =>
  page.evaluate(async (required) => {
    const faces = [...document.fonts];
    await Promise.allSettled(faces.map((face) => face.load()));
    await document.fonts.ready;
    if (
      faces.some(({ status }) => status !== 'loaded') ||
      required.some(
        ({ family, weight, style }) =>
          !faces.some(
            (face) =>
              face.family.replace(/^['"]|['"]$/gu, '') === family &&
              (weight === undefined || face.weight === weight) &&
              (style === undefined || face.style === style),
          ),
      )
    )
      return 'font';

    const images = [...document.images];
    for (const image of images) image.loading = 'eager';
    const decodes = await Promise.allSettled(images.map((image) => image.decode()));
    if (
      decodes.some(({ status }) => status === 'rejected') ||
      images.some(({ naturalWidth, naturalHeight }) => naturalWidth < 1 || naturalHeight < 1)
    )
      return 'image';

    // force layout after assets settle; animation-frame callbacks stall with page scripts disabled
    document.documentElement.getBoundingClientRect();
    return undefined;
  }, requiredFonts);
