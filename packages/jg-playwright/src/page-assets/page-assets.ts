import { expect, type Page } from '@playwright/test';

/**
 * Lists, in the page, the images that haven't loaded, or that loaded nothing a browser can draw.
 * @returns Each such image's source.
 */
const listUnreadyImages = (): string[] =>
  [...document.images]
    .filter((image) => !image.complete || image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src);

/**
 * Waits, in the page, for two animation frames, so layout and observers settle after the assets.
 * @returns A promise that resolves after the second frame.
 */
const waitForTwoFrames = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });

/**
 * Waits until the page looks finished, before a screenshot or a layout check: its web fonts are
 * loaded, every `<img>` has loaded an image it can draw, and two animation frames have passed, so
 * layout that depends on them has settled. A broken image fails it, naming the image. A lazy image
 * below the fold never loads, so scroll it into view first.
 * @param page The page.
 * @returns A promise that resolves once the page's assets are ready, or rejects with Playwright's
 * assertion error after its expect timeout.
 * @example
 * import { expect, test } from '@playwright/test';
 * import { waitForPageAssets } from 'jg-playwright';
 *
 * test('the home page matches its screenshot', async ({ page }) => {
 *   await page.goto('/');
 *   await waitForPageAssets(page);
 *   await expect(page).toHaveScreenshot();
 * });
 */
export const waitForPageAssets = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await expect
    .poll(() => page.evaluate(listUnreadyImages), {
      message: 'Every image on the page must load an image it can draw',
    })
    .toStrictEqual([]);
  await page.evaluate(waitForTwoFrames);
};
