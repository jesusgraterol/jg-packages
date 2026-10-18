import { expect, test } from '@playwright/test';

import { startDelayingProxy } from './site.test-utils.ts';

/*
 * The hero's package tiles, and the page-loading progress bar: when it shows, when it hides, and
 * how it looks with reduced motion.
 */

// what the page records about the progress bar, in session storage, which outlives the page
type IProgressRecord = { shownAfter?: number; leftAfter?: number; animation?: string };

test('the hero shows at most 8 tiles and links to every package', async ({ page }) => {
  await page.goto('/');

  const tiles = page.locator('ul[aria-label="The packages"] > li');
  const packageCount = await page
    .locator('#packages a[href^="/packages/"]')
    .evaluateAll((links) => new Set(links.map((link) => link.getAttribute('href'))).size);
  const viewAll = page.getByRole('link', { name: `View all ${String(packageCount)} packages` });

  expect(await tiles.count()).toBeGreaterThan(0);
  expect(await tiles.count()).toBeLessThanOrEqual(8);
  await expect(viewAll).toHaveAttribute('href', '#packages');
  await expect(viewAll.locator('svg.lucide-arrow-down')).toHaveCount(1);
});

test('the progress bar shows while a page is slow, and stays hidden after going back', async ({
  baseURL,
  page,
}) => {
  await page.goto('/');
  const tile = page.locator('ul[aria-label="The packages"] > li a').first();
  const target = (await tile.getAttribute('href')) ?? '';
  const bar = page.locator('[data-navigation-progress]');
  await expect(bar).toBeHidden();

  // an in-page jump never shows it
  await page.getByRole('link', { name: /^View all \d+ packages$/u }).click();
  await page.waitForTimeout(300);
  await expect(bar).toBeHidden();

  const proxy = await startDelayingProxy(baseURL ?? '', target, 600);
  try {
    await page.goto(`${proxy.origin}/`);
    await page.evaluate(() => {
      const record = (entry: IProgressRecord): void => {
        const stored = JSON.parse(sessionStorage.getItem('progress') ?? '{}') as IProgressRecord;
        sessionStorage.setItem('progress', JSON.stringify({ ...stored, ...entry }));
      };
      sessionStorage.removeItem('progress');
      let clickedAt = 0;
      document.addEventListener(
        'click',
        () => {
          clickedAt = performance.now();
        },
        { capture: true },
      );
      const progress = document.querySelector<HTMLElement>('[data-navigation-progress]');
      new MutationObserver(() => {
        if (progress !== null && !progress.hidden) {
          record({
            shownAfter: performance.now() - clickedAt,
            animation: getComputedStyle(progress.firstElementChild as Element).animationName,
          });
        }
      }).observe(progress as Node, { attributes: true });
      addEventListener('pagehide', () => {
        record({ leftAfter: performance.now() - clickedAt });
      });
    });

    await page.locator(`ul[aria-label="The packages"] a[href="${target}"]`).click();
    await page.waitForURL(`**${target}`);

    const record = await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('progress') ?? '{}') as IProgressRecord,
    );
    // it waited 150 ms, then showed, sweeping, before the held page arrived
    expect(record.shownAfter).toBeGreaterThanOrEqual(150);
    expect(record.leftAfter).toBeGreaterThan(record.shownAfter ?? Infinity);
    expect(record.animation).toBe('jg-progress');
    await expect(bar).toBeHidden();

    await page.goBack();
    await page.waitForURL(`${proxy.origin}/`);
    await expect(bar).toBeHidden();
  } finally {
    await proxy.close();
  }
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the progress bar is still and transitions are instant', async ({ page }) => {
    await page.goto('/');

    const styles = await page.evaluate(() => {
      const progress = document.querySelector<HTMLElement>('[data-navigation-progress]');
      if (progress === null) {
        throw new Error('The page has no progress bar.');
      }
      progress.hidden = false;
      const indicator = getComputedStyle(progress.firstElementChild as Element);
      return {
        animation: indicator.animationName,
        indicatorWidth: parseFloat(indicator.width),
        trackWidth: progress.getBoundingClientRect().width,
        transition: getComputedStyle(document.querySelector('.transition-colors') as Element)
          .transitionDuration,
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      };
    });

    // a still bar a third wide
    expect(styles.animation).toBe('none');
    expect(styles.indicatorWidth).toBeCloseTo(styles.trackWidth / 3, 0);
    expect(parseFloat(styles.transition)).toBeLessThan(0.001);
    expect(styles.scrollBehavior).toBe('auto');
  });
});
