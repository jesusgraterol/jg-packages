import type { Browser, BrowserContext, Page } from 'playwright';

import { renderError } from './errors.js';
import { beforeAbort, withCleanup } from './lifecycle.js';
import { withPreparedPage } from './page.js';
import type { IHtmlRenderInput, IOfflineRenderer, IOfflineRendererOptions } from './types.js';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Captures a PNG and checks that Chromium produced the exact requested image.
 * @param page The prepared page.
 * @param input The render settings.
 * @returns The checked PNG bytes.
 */
const capture = async (page: Page, input: IHtmlRenderInput): Promise<Buffer> => {
  const png = await page
    .screenshot({
      type: 'png',
      animations: 'disabled',
      scale: 'css',
      omitBackground: input.transparent ?? false,
      ...(input.timeoutMs === undefined ? {} : { timeout: input.timeoutMs }),
    })
    .catch(() => {
      throw renderError('capture');
    });
  if (
    png.byteLength < 33 ||
    !png.subarray(0, 8).equals(PNG_SIGNATURE) ||
    png.readUInt32BE(8) !== 13 ||
    png.toString('ascii', 12, 16) !== 'IHDR' ||
    png.readUInt32BE(16) !== input.width ||
    png.readUInt32BE(20) !== input.height
  )
    throw renderError('invalid-png');
  return png;
};

/**
 * Runs one rendering session in a disposable context on caller-owned Chromium. Pages are offline,
 * document JavaScript and service workers are disabled, motion is reduced and the pixel scale is one.
 * @param browser The caller's launched Playwright Chromium.
 * @param options Safe context defaults and optional cancellation.
 * @param work The renders or trusted operations to perform before the session is closed.
 * @returns The caller's result after closing the owned context.
 * @example
 * import { chromium } from 'playwright';
 * import { withOfflineRenderer } from 'jg-render';
 *
 * const browser = await chromium.launch();
 * try {
 *   const png = await withOfflineRenderer(browser, {}, (render) =>
 *     render.renderPng({
 *       html: '<!doctype html><svg width="80" height="80"><circle cx="40" cy="40" r="24"/></svg>',
 *       width: 80,
 *       height: 80,
 *       transparent: true,
 *     }),
 *   );
 *   // png contains an 80 by 80 image
 *   void png;
 * } finally {
 *   await browser.close();
 * }
 * @throws
 * - INVALID_HTML_RENDER_OPTIONS: The HTML render options are invalid.
 * - HTML_RENDER_FAILED: The HTML could not be rendered to PNG.
 */
export const withOfflineRenderer = async <T>(
  browser: Browser,
  options: IOfflineRendererOptions,
  work: (renderer: IOfflineRenderer) => Promise<T>,
): Promise<T> => {
  if (browser.browserType().name() !== 'chromium') throw renderError('browser');
  const { signal, colorScheme, locale, timezoneId } = options;
  if (signal?.aborted) throw renderError('cancelled');
  let context: BrowserContext;
  try {
    context = await browser.newContext({
      deviceScaleFactor: 1,
      javaScriptEnabled: false,
      offline: true,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      ...(colorScheme === undefined ? {} : { colorScheme }),
      ...(locale === undefined ? {} : { locale }),
      ...(timezoneId === undefined ? {} : { timezoneId }),
    });
  } catch {
    throw renderError(signal?.aborted ? 'cancelled' : 'context');
  }
  const renderer: IOfflineRenderer = {
    preparePage: (input, usePage) => withPreparedPage(context, signal, input, usePage),
    renderPng: (input) => withPreparedPage(context, signal, input, (page) => capture(page, input)),
  };
  return withCleanup(
    () => beforeAbort(signal, signal, () => work(renderer)),
    () => context.close(),
  );
};
