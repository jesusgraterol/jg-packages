import { expect, test } from '@playwright/test';

import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { expectNoHorizontalOverflow } from './overflow.js';

// headless Chromium hides scrollbars unless this default argument is dropped, and the pages here
// should show them, as a desktop browser does
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/fits': toHtmlPage('<main><p>Short text that wraps.</p></main>'),
    '/overflows': toHtmlPage(
      '<main class="page"><div class="hero wide" style="width: 600px">Wide</div><p>Fits</p></main>',
    ),
    '/scrollbar': toHtmlPage(
      // a page tall enough for a vertical scrollbar, and a box exactly as wide as the window, which
      // overflows the content box beside a classic scrollbar
      '<div class="full" style="width: 100vw; height: 3000px">Tall</div>',
      '<style>html { overflow-y: scroll; }</style>',
    ),
    '/settles': toHtmlPage(
      '<div class="late" style="width: 600px">Wide until a script narrows it</div>' +
        '<script>setTimeout(() => { document.querySelector(".late").style.width = "100px"; }, 300);</script>',
    ),
  });
});

test.afterAll(async () => {
  await server.close();
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
});

test('passes when the page fits the viewport', async ({ page }) => {
  await page.goto(`${server.origin}/fits`);

  await expectNoHorizontalOverflow(page);
});

test('waits for a page that overflows only until it settles', async ({ page }) => {
  await page.goto(`${server.origin}/settles`);

  await expectNoHorizontalOverflow(page);
});

test('fails with the widths and the elements past the right edge', async ({ page }) => {
  await page.goto(`${server.origin}/overflows`);

  const error = await expectNoHorizontalOverflow(page).then(
    () => null,
    (failure: unknown) => failure,
  );

  expect(error).toBeInstanceOf(Error);
  const message = (error as Error).message;
  expect(message).toContain('The page must not scroll horizontally');
  expect(message).toContain('in a 320 px viewport');
  expect(message).toContain('div.hero.wide');
  expect(message).not.toContain('main.page');
});

test.describe('with classic scrollbars', () => {
  test('measures against the content box, so a box under the scrollbar still fails', async ({
    page,
  }) => {
    await page.goto(`${server.origin}/scrollbar`);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    test.skip(clientWidth === 320, 'This browser draws overlay scrollbars, which take no width');

    await expect(expectNoHorizontalOverflow(page)).rejects.toThrow('div.full');
  });
});
