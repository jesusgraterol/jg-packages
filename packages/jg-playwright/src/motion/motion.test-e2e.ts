import { expect, test } from '@playwright/test';

import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { inspectMotion } from './motion.js';

// keyframes for each kind of animation the page runs
const STYLES = `<style>
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(40px); } }
  @keyframes grow { to { width: 200px; } }
  @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes still { from { transform: translateX(10px); } to { transform: translateX(10px); } }
  .slide { animation: slide 2s linear infinite; }
  .grow { width: 10px; animation: grow 1.5s 3; }
  .fade { animation: fade 2s infinite; }
  .still { animation: still 2s infinite; }
  .paused { animation: slide 2s infinite paused; }
  @media (prefers-reduced-motion: reduce) {
    .respects-preference { animation: none; }
  }
</style>`;

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/': toHtmlPage(
      [
        '<div class="slide" data-slot="spinner">Slides</div>',
        '<span class="grow">Grows</span>',
        '<p class="fade">Fades</p>',
        '<p class="still">Stays</p>',
        '<p class="paused">Paused</p>',
      ].join(''),
      STYLES,
    ),
    '/respects-preference': toHtmlPage(
      '<div class="slide respects-preference">Slides unless reduced</div>',
      STYLES,
    ),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('lists the running animations that move or resize an element, and nothing else', async ({
  page,
}) => {
  await page.goto(server.origin);

  const inspection = await inspectMotion(page);

  expect(inspection.prefersReducedMotion).toBe(false);
  expect(inspection.movingAnimations).toStrictEqual([
    {
      tagName: 'div',
      slot: 'spinner',
      properties: ['transform'],
      iterations: 'infinite',
      durationMs: 2000,
    },
    { tagName: 'span', slot: null, properties: ['width'], iterations: 3, durationMs: 1500 },
  ]);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('reports the preference, and nothing moving on a page that honors it', async ({ page }) => {
    await page.goto(`${server.origin}/respects-preference`);

    expect(await inspectMotion(page)).toStrictEqual({
      prefersReducedMotion: true,
      movingAnimations: [],
    });
  });
});
