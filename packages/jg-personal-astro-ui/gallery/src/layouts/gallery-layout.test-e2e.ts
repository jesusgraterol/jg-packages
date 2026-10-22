import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, inspectMotion, waitForPageAssets } from 'jg-playwright';
import { expectNoAxeViolations } from 'jg-playwright/axe';

import { GALLERY_EXAMPLES, GALLERY_PAGES } from '../catalog/index.ts';

test('every public Astro component has a real rendered example', async ({ page }) => {
  const manifest = JSON.parse(
    await readFile(
      process.env['JG_UI_GALLERY_ROOT'] === undefined
        ? new URL('../../../package.json', import.meta.url)
        : join(
            process.env['JG_UI_GALLERY_ROOT'],
            'node_modules',
            'jg-personal-astro-ui',
            'package.json',
          ),
      'utf8',
    ),
  ) as { exports: Record<string, unknown> };
  const components = Object.entries(manifest.exports)
    .filter(([, target]) => typeof target === 'string' && target.endsWith('.astro'))
    .map(([subpath]) => subpath.slice(2))
    .sort();
  expect(GALLERY_EXAMPLES.map(({ subpath }) => subpath).sort()).toStrictEqual(components);
  for (const path of ['/', ...GALLERY_PAGES.map(({ href }) => href)]) {
    await page.goto(path);
    for (const example of GALLERY_EXAMPLES.filter((example) => example.path === path)) {
      await expect(page.locator(example.selector), example.subpath).not.toHaveCount(0);
    }
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`pages are styled, accessible, and fit ${width}px in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 800 });
      for (const path of ['/', ...GALLERY_PAGES.map(({ href }) => href)]) {
        await page.goto(path);
        await waitForPageAssets(page);
        await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', colorScheme);
        await expect(page.getByRole('main')).toBeVisible();
        await expect(page.locator('body')).toHaveCSS('font-family', /Ubuntu Sans/);
        await expect(page.getByRole('banner')).toHaveCSS('position', 'sticky');
        await expectNoHorizontalOverflow(page);
        await expectNoAxeViolations(page);
        expect((await inspectMotion(page)).movingAnimations).toStrictEqual([]);
      }
    });
  }
}

test('keyboard tabs and nested groups keep their selection independent', async ({ page }) => {
  await page.goto('/interactions/');
  const outer = page.getByRole('tablist', { name: 'Example language', exact: true });
  const first = outer.getByRole('tab', { name: 'TypeScript', exact: true });
  await first.focus();
  await first.press('ArrowRight');
  await expect(outer.getByRole('tab', { name: 'JavaScript with a longer label' })).toBeFocused();
  await expect(
    page.getByRole('tabpanel', { name: 'JavaScript with a longer label' }),
  ).toBeVisible();
  await outer.getByRole('tab', { name: 'JavaScript with a longer label' }).press('Home');
  await page.getByRole('tab', { name: 'Details', exact: true }).click();
  await expect(page.getByRole('tabpanel', { name: 'Details', exact: true })).toBeVisible();
  await expect(first).toHaveAttribute('aria-selected', 'true');
  const installGroups = page.getByRole('tablist', { name: /package manager/i });
  await installGroups.first().getByRole('tab', { name: 'pnpm', exact: true }).click();
  await expect(
    installGroups.last().getByRole('tab', { name: 'pnpm', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
});

test('dialog opens from the keyboard, closes, and restores its trigger', async ({ page }) => {
  await page.goto('/interactions/');
  const trigger = page.getByRole('button', { name: 'Open example dialog', exact: true });
  await trigger.focus();
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Example dialog', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Finish', exact: true })).toBeFocused();
  await expectNoAxeViolations(page);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS('outline-style', 'solid');
});

test('Pagefind returns real indexed content, no matches, and an unavailable state', async ({
  page,
}) => {
  await page.goto('/interactions/');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
  const input = dialog.getByRole('searchbox', { name: 'Search the site' });
  await expect(input).toBeFocused();
  await input.fill('Rich prose');
  await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
  await input.fill('zzzxqnomatch');
  await expect(dialog.getByText('No results for “zzzxqnomatch”.')).toBeVisible();
  await input.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Search', exact: true }).click();
  const unavailable = page.locator('#unavailable-search');
  await unavailable.getByRole('searchbox').fill('anything');
  await expect(unavailable.getByText("Search isn't available on this page.")).toBeVisible();
});

test('copy failures provide guidance without a working clipboard', async ({
  page,
  browserName,
  context,
}) => {
  if (browserName === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/interactions/');
  const missing = page.getByRole('button', { name: /missing example$/ });
  await missing.click();
  await expect(missing).toHaveAttribute('data-copy-state', 'error');
  await expect(page.locator('[data-copy-hint]:visible')).toContainText(/copy/i);
  const literal = page.getByRole('button', { name: /literal example$/ });
  if (browserName === 'chromium') {
    await literal.click();
    await expect(literal).toHaveAttribute('data-copy-state', 'success');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'gallery clipboard text',
    );
  } else {
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
        },
      }),
    );
    await literal.click();
    await expect(literal).toHaveAttribute('data-copy-state', 'error');
  }
});

test('Markdown builds actual code windows and external-link notices', async ({ page }) => {
  await page.goto('/technical-content/');
  const markdown = page.locator('[data-markdown-example]');
  await expect(markdown.locator('[data-code-window]')).toHaveCount(1);
  await expect(markdown.locator('pre')).toContainText('Hello from Astro UI');
  await expect(markdown.getByRole('button', { name: /Copy/ })).toBeVisible();
  await expect(markdown.getByRole('link', { name: /Astro documentation/ })).toHaveAttribute(
    'target',
    '_blank',
  );
});

test('mobile navigation and theme controls work from the shared frame', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  const summary = page.locator('summary[aria-label="Navigation menu"]');
  await summary.click();
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', 'dark');
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Foundations' })
    .click();
  await expect(page).toHaveURL('/foundations/');
  await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', 'dark');
  await expect(summary).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
