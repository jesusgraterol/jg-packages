import { expect, test } from '@playwright/test';

import {
  PIXEL_PNG,
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { waitForPageAssets } from './page-assets.js';

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/slow.png': { body: PIXEL_PNG, contentType: 'image/png', delayMs: 500 },
    '/broken.png': { body: 'not an image', contentType: 'image/png' },
    '/slow-image': toHtmlPage(
      // the image is added after load, so goto returns before it has loaded
      '<script>addEventListener("load", () => { const image = new Image(); image.src = "/slow.png"; image.alt = "Slow"; document.body.append(image); });</script>',
    ),
    '/broken-image': toHtmlPage('<img src="/broken.png" alt="Broken" />'),
    '/no-images': toHtmlPage('<p>Text only</p>'),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('waits for an image that loads after the page', async ({ page }) => {
  await page.goto(`${server.origin}/slow-image`);

  await waitForPageAssets(page);

  expect(
    await page.evaluate(() =>
      [...document.images].map(({ complete, naturalWidth }) => ({ complete, naturalWidth })),
    ),
  ).toStrictEqual([{ complete: true, naturalWidth: 1 }]);
});

test('resolves for a page without images once its fonts are ready', async ({ page }) => {
  await page.goto(`${server.origin}/no-images`);

  await waitForPageAssets(page);

  expect(await page.evaluate(() => document.fonts.status)).toBe('loaded');
});

test('fails on an image that loads nothing it can draw, naming it', async ({ page }) => {
  await page.goto(`${server.origin}/broken-image`);

  await expect(waitForPageAssets(page)).rejects.toThrow('/broken.png');
});
