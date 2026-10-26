import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { PACKAGE_CATALOG } from '../src/site.config.ts';
import {
  BUILD_DIRECTORY,
  findStackedDividers,
  NOT_FOUND_PATH,
  PAGE_PATHS,
  ROUTES,
} from './site.test-utils.ts';

/*
 * Every route of the built site: each public page with its speculation rules and its Markdown
 * version, the 404 page, and on every route, axe in both themes, no overflow at 320 px, and no
 * stacked dividers on mobile and desktop.
 */

test('the suite checks the home page, and the two pages of each listed package', () => {
  expect(PAGE_PATHS).toStrictEqual(
    [
      '/',
      ...Object.keys(PACKAGE_CATALOG).flatMap((name) => [
        `/packages/${name}/`,
        `/packages/${name}/recipes/`,
      ]),
    ].sort(),
  );
});

for (const path of PAGE_PATHS) {
  test(`${path} loads with its speculation rules and its Markdown version`, async ({
    page,
    request,
  }) => {
    const response = await page.goto(path);

    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-copy-button]:not([data-copy-display="icon"])')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    // the rules are JSON the browser reads, with prerendering on hover
    const rules = JSON.parse(
      (await page.locator('script[type="speculationrules"]').textContent()) ?? '',
    ) as { prerender?: unknown };
    expect(Array.isArray(rules.prerender)).toBe(true);
    expect(await page.evaluate(() => HTMLScriptElement.supports('speculationrules'))).toBe(true);

    const markdownUrl = await page
      .locator('link[rel="alternate"][type="text/markdown"]')
      .getAttribute('href');
    const markdownPath = new URL(markdownUrl ?? '').pathname;
    expect(markdownPath).toBe(`${path}index.md`);
    const markdown = await request.get(markdownPath);
    expect(markdown.status()).toBe(200);
    expect(markdown.headers()['content-type']).toContain('text/markdown');
    const body = await markdown.text();
    expect(body).toBe(await readFile(join(BUILD_DIRECTORY, markdownPath), 'utf8'));
    expect(body).toMatch(/^# \S/u);
  });
}

test('the 404 page answers 404, stays out of indexes, and leads home', async ({ page }) => {
  const response = await page.goto(NOT_FOUND_PATH);

  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  // Pagefind leaves out a page whose main content isn't marked for it
  await expect(page.locator('main')).not.toHaveAttribute('data-pagefind-body');
  await page.getByRole('link', { name: 'Back to the home page' }).click();
  await expect(page).toHaveURL('/');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`in the ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of ROUTES) {
      test(`${path} has no axe violations`, async ({ page }) => {
        // axe scans the whole page, and the largest API references, jg-utilities' and
        // jg-postgres', take close to a minute while the suite's other workers run
        test.setTimeout(120_000);
        await page.goto(path);
        await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', colorScheme);

        const { violations } = await new AxeBuilder({ page }).analyze();

        expect(
          violations.map(
            ({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`,
          ),
        ).toStrictEqual([]);
      });
    }
  });
}

test.describe('at 320 px', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  for (const path of ROUTES) {
    test(`${path} doesn't overflow sideways`, async ({ page }) => {
      await page.goto(path);

      const { clientWidth, scrollWidth } = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));

      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });
  }
});

for (const width of [390, 1280]) {
  test.describe(`at ${String(width)} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const path of ROUTES) {
      test(`${path} has no stacked dividers`, async ({ page }) => {
        await page.goto(path);

        expect(await page.evaluate(findStackedDividers)).toStrictEqual([]);
      });
    }
  });
}
