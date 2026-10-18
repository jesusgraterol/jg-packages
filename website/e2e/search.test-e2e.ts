import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Search: the header's button and the shortcuts open the dialog with its field focused, typing
 * lists results from the Pagefind index, and closing gives focus back.
 */

test('the search button opens the dialog, and Escape gives focus back to it', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Search' });

  await trigger.click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox', { name: 'Search the site' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('typing lists matching pages, and a result opens its page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Search' });

  await dialog.getByRole('searchbox').fill('fetch');

  await expect(dialog.locator('[data-search-status]')).toHaveText(/^\d+ results? for “fetch”\.$/u);
  // each result is titled with its page's heading, the package's name
  const result = dialog.locator('[data-search-results] a[href="/packages/jg-fetch/"]');
  await expect(result.locator('span').first()).toHaveText('jg-fetch');
  // the excerpt marks the match
  await expect(dialog.locator('[data-search-results] mark').first()).toBeVisible();
  await result.click();
  await expect(page).toHaveURL('/packages/jg-fetch/');
});

test('a recipes page is named apart from its package page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Search' });

  await dialog.getByRole('searchbox').fill('ApiException');

  await expect(
    dialog.locator('[data-search-results] a[href="/packages/jg-exception/recipes/"] span').first(),
  ).toHaveText('jg-exception recipes');
});

test('a search without matches says so', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Search' });

  // Pagefind matches a word's start when the whole word isn't indexed, so the query starts with
  // nothing on the site either
  await dialog.getByRole('searchbox').fill('xylophonequartz');

  await expect(dialog.locator('[data-search-status]')).toHaveText(
    'No results for “xylophonequartz”.',
  );
  await expect(dialog.locator('[data-search-results] li')).toHaveCount(0);
});

test('/ and Ctrl+K open search, / types into the open field, and one Escape closes it', async ({
  page,
}) => {
  await page.goto('/packages/jg-fetch/');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const field = dialog.getByRole('searchbox');

  await page.keyboard.press('/');
  await expect(field).toBeFocused();
  await page.keyboard.type('a/b');
  await expect(field).toHaveValue('a/b');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.keyboard.press('Control+k');
  await expect(field).toBeFocused();
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('the header keeps a search button, named Search, beside the menu', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Search', exact: true });

    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  });
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the open dialog with results has no axe violations in the ${colorScheme} theme`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Search' });
    await dialog.getByRole('searchbox').fill('cache');
    await expect(dialog.locator('[data-search-results] li').first()).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map(
        ({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`,
      ),
    ).toStrictEqual([]);
  });
}
