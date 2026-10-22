import { expect, test } from '@playwright/test';

test('an index load failure exposes retry and the next load recovers real Pagefind results', async ({
  page,
}) => {
  let loads = 0;
  const requests: string[] = [];
  await page.route('**/pagefind/pagefind.js*', async (route) => {
    loads++;
    requests.push(route.request().url());
    if (loads === 1) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/interactions/');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
  await dialog.getByRole('searchbox', { name: 'Search the site', exact: true }).fill('Rich prose');
  await expect(
    dialog.getByText("Search isn't available on this page.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
  expect(loads).toBe(2);
  expect(new URL(requests[1] ?? '').searchParams.get('__jg_search_retry')).toBe('1');
});

test('loading, rapid input, empty results, and reopening preserve the latest query', async ({
  page,
}) => {
  const requested = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route('**/pagefind/pagefind.js', async (route) => {
    requested.resolve();
    await release.promise;
    await route.continue();
  });
  try {
    await page.goto('/interactions/');
    await page.keyboard.press('/');
    const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
    const input = dialog.getByRole('searchbox', { name: 'Search the site', exact: true });
    await input.fill('old query');
    await requested.promise;
    await expect(dialog.getByRole('status')).toHaveText('Searching…');
    await expect(dialog.locator('[data-search-results]')).toHaveAttribute('aria-busy', 'true');
    await input.fill('zzzxqnomatch');
    await input.fill('Rich prose');
    release.resolve();
    await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
    await expect(dialog.getByRole('status')).toHaveText('2 results for “Rich prose”.');
    await input.fill('zzzxqnomatch');
    await expect(dialog.getByRole('status')).toHaveText('No results for “zzzxqnomatch”.');
    await input.clear();
    await expect(dialog.getByRole('status')).toBeEmpty();
    await expect(dialog.getByRole('status')).toHaveCSS('display', 'block');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await input.fill('Rich prose');
    await input.press('Escape');
    await expect(dialog).not.toBeVisible();
    await page.keyboard.press('/');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Rich prose');
    await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
  } finally {
    release.resolve();
  }
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`configured phone search in ${colorScheme}`, () => {
    test.use({
      viewport: { width: 320, height: 400 },
      hasTouch: true,
      colorScheme,
      reducedMotion: 'reduce',
    });
    test('uses configured names and a touch-sized input with reachable results and close action', async ({
      page,
    }) => {
      await page.goto('/interactions/');
      const trigger = page.getByRole('button', { name: 'Find documentation', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Find documentation', exact: true });
      const input = dialog.getByRole('searchbox', { name: 'Search documentation', exact: true });
      await expect(input).toBeFocused();
      await expect(input).toHaveAttribute('placeholder', 'e.g. Installation');
      await expect(input).toHaveCSS('font-size', '16px');
      await input.press('Control+k');
      await expect(page.getByRole('dialog', { name: 'Search', exact: true })).not.toBeVisible();
      await expect(input).toBeFocused();
      await input.fill('Rich prose');
      await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
      await input.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
    });
  });
}

test('typing a slash in another dialog field does not activate the search shortcut', async ({
  page,
}) => {
  await page.goto('/interactions/');
  await page.getByRole('button', { name: 'Open mobile reference', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Reference note', exact: true });
  await input.fill('Notes');
  await input.press('/');
  await expect(input).toHaveValue('Notes/');
  await expect(page.getByRole('dialog', { name: 'Search', exact: true })).not.toBeVisible();
});

test('search remains usable after an Astro client navigation replaces the page', async ({
  page,
}) => {
  await page.goto('/interactions/');
  // the URL changes before Astro finishes page scripts and focus restoration
  await page.evaluate(() => {
    const onPageLoad = (): void => {
      if (location.search !== '?dialog-navigation=1') return;
      document.documentElement.setAttribute('data-search-navigation-ready', 'true');
      document.removeEventListener('astro:page-load', onPageLoad);
    };
    document.addEventListener('astro:page-load', onPageLoad);
  });
  await page.getByRole('button', { name: 'Open mobile reference', exact: true }).click();
  await page.getByRole('link', { name: 'Continue browsing', exact: true }).click();
  await expect(page).toHaveURL(/\?dialog-navigation=1$/u);
  await expect(page.locator('html')).toHaveAttribute('data-search-navigation-ready', 'true');
  await page.keyboard.press('/');
  const dialog = page.getByRole('dialog', { name: 'Search', exact: true });
  const input = dialog.getByRole('searchbox', { name: 'Search the site', exact: true });
  await expect(input).toBeFocused();
  await input.fill('Rich prose');
  await expect(dialog.getByRole('link', { name: /^Documentation Reading/ })).toBeVisible();
  await input.press('Control+k');
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await input.press('Escape');
  await expect(dialog).not.toBeVisible();
});
