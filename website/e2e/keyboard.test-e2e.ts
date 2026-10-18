import { expect, test } from '@playwright/test';

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
