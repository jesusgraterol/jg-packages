import { expect, test, type Locator } from '@playwright/test';

import { SITE_CONFIG } from '../src/site.config.ts';

/*
 * Keyboard use and remembered choices: the skip link, the theme, the mobile menu, and the package
 * manager tabs.
 */

test('the skip link comes first and moves focus to the main content', async ({ page }) => {
  await page.goto('/packages/jg-fetch/');
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });

  await page.keyboard.press('Tab');

  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/packages/jg-fetch/#main-content');
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.closest('main') !== null)).toBe(true);
});

test('the theme choice persists across reloads and pages', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-resolved-theme', 'light');

  await page.getByRole('button', { name: 'Use dark theme' }).click();

  await expect(html).toHaveAttribute('data-resolved-theme', 'dark');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), SITE_CONFIG.storageKeys.theme),
  ).toBe('dark');
  await page.reload();
  await expect(html).toHaveAttribute('data-resolved-theme', 'dark');
  await page.goto('/packages/jg-fetch/');
  await expect(html).toHaveAttribute('data-resolved-theme', 'dark');
  await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.reload();
  await expect(html).toHaveAttribute('data-resolved-theme', 'light');
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the menu opens from the keyboard and Escape closes it, giving focus back', async ({
    page,
  }) => {
    await page.goto('/packages/jg-fetch/');
    const menuButton = page.locator('[data-site-menu] summary');
    const menu = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeHidden();

    await menuButton.focus();
    await page.keyboard.press('Enter');

    await expect(menu).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('the menu closes on a click outside it, and after choosing a link', async ({ page }) => {
    await page.goto('/packages/jg-fetch/');
    const menuButton = page.locator('[data-site-menu] summary');
    const menu = page.getByRole('navigation', { name: 'Mobile navigation' });

    await menuButton.click();
    await expect(menu).toBeVisible();
    // the open menu covers most of the page's width, so the click lands at its left edge
    await page.mouse.click(8, 600);
    await expect(menu).toBeHidden();

    await menuButton.click();
    const [firstItem] = SITE_CONFIG.navigation;
    await menu.getByRole('link', { name: firstItem?.label }).click();
    await expect(page).toHaveURL(firstItem?.href ?? '');
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden();
  });
});

test('the package manager tabs work by keyboard and the choice carries across pages', async ({
  page,
}) => {
  await page.goto('/packages/jg-fetch/');
  const tablist = page.getByRole('tablist', { name: 'Package manager' });
  const npm = tablist.getByRole('tab', { name: 'npm', exact: true });
  const pnpm = tablist.getByRole('tab', { name: 'pnpm', exact: true });

  await npm.focus();
  await page.keyboard.press('ArrowRight');

  await expect(pnpm).toBeFocused();
  await expect(pnpm).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('pnpm add jg-fetch');
  await page.keyboard.press('ArrowRight');
  await expect(npm).toBeFocused();
  await page.keyboard.press('End');
  await expect(pnpm).toBeFocused();
  await page.keyboard.press('Home');
  await expect(npm).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(pnpm).toHaveAttribute('aria-selected', 'true');

  await page.goto('/packages/jg-fs/');
  await expect(
    page
      .getByRole('tablist', { name: 'Package manager' })
      .getByRole('tab', { name: 'pnpm', exact: true }),
  ).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText('pnpm add jg-fs');
});

/**
 * Waits until a fragment's heading is readable beneath the sticky site header.
 * @param heading The destination heading.
 * @returns A promise that resolves once the heading clears the header.
 */
const expectHeadingBelowHeader = async (heading: Locator): Promise<void> => {
  await expect(heading).toBeInViewport();
  await expect
    .poll(() =>
      heading.evaluate((target) => {
        const header = target.ownerDocument.querySelector('body > header');
        if (header === null) throw new Error('The site header is missing.');
        return target.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
      }),
    )
    .toBeGreaterThanOrEqual(0);
};

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`documentation outlines and adjacent pages work by keyboard at ${String(width)}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/packages/jg-fetch/');
      await expect(page.getByRole('main')).toHaveCount(1);
      const outline = page.getByRole('navigation', { name: 'On this page', exact: true });
      await expect(outline).toHaveCount(1);
      if (width < 1024) {
        const disclosure = outline
          .getByText('On this page', { exact: true })
          .filter({ visible: true });
        await disclosure.focus();
        await disclosure.press('Enter');
      }
      const apiLink = outline.getByRole('link', { name: 'API reference', exact: true });
      await apiLink.focus();
      await expect(apiLink).toBeFocused();
      expect(await apiLink.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe(
        'none',
      );
      await apiLink.press('Enter');
      await expect(page).toHaveURL('/packages/jg-fetch/#api-reference');
      await expectHeadingBelowHeader(
        page.getByRole('heading', { name: 'API reference', exact: true }),
      );
      await expect(outline.getByRole('link', { name: 'Functions', exact: true })).toBeVisible();

      const next = page
        .getByRole('navigation', { name: 'Page navigation', exact: true })
        .getByRole('link');
      await expect(next).toHaveAttribute('rel', 'next');
      await next.focus();
      await next.press('Enter');
      await expect(page).toHaveURL('/packages/jg-fetch/recipes/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute(
        'data-pagefind-meta',
        'title:jg-fetch recipes',
      );
      const recipeOutline = page.getByRole('navigation', { name: 'On this page', exact: true });
      if (width < 1024) {
        const disclosure = recipeOutline
          .getByText('On this page', { exact: true })
          .filter({ visible: true });
        await disclosure.focus();
        await disclosure.press('Enter');
      }
      const firstRecipe = recipeOutline.getByRole('link').first();
      const recipeTitle = await firstRecipe.innerText();
      const fragment = await firstRecipe.getAttribute('href');
      expect(fragment).toMatch(/^#/u);
      await firstRecipe.focus();
      await firstRecipe.press('Enter');
      await expect(page).toHaveURL(`/packages/jg-fetch/recipes/${fragment ?? ''}`);
      await expectHeadingBelowHeader(
        page.getByRole('heading', { level: 2, name: recipeTitle, exact: true }),
      );
      const previous = page
        .getByRole('navigation', { name: 'Page navigation', exact: true })
        .getByRole('link');
      await expect(previous).toHaveAttribute('rel', 'prev');
      await previous.focus();
      await previous.press('Enter');
      await expect(page).toHaveURL('/packages/jg-fetch/');
    });
  }
}

test.describe('documentation without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  for (const path of ['/packages/jg-fetch/', '/packages/jg-fetch/recipes/']) {
    test(`${path} retains native outline and adjacent-page links`, async ({ page }) => {
      await page.goto(path);
      const outline = page.getByRole('navigation', { name: 'On this page', exact: true });
      await outline.getByText('On this page', { exact: true }).filter({ visible: true }).click();
      const link = outline.getByRole('link').first();
      const fragment = await link.getAttribute('href');
      expect(fragment).toMatch(/^#/u);
      await link.click();
      await expect(page).toHaveURL(`${path}${fragment ?? ''}`);
      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(
        page.getByRole('navigation', { name: 'Page navigation', exact: true }).getByRole('link'),
      ).toHaveAttribute(
        'href',
        path.endsWith('/recipes/') ? '/packages/jg-fetch/' : '/packages/jg-fetch/recipes/',
      );
    });
  }
});
