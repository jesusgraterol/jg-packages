import { expect, test } from '@playwright/test';

test('hierarchical outline links retain nesting and direct fragment margins', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/documentation/#reference-boundaries');
  const heading = page.getByRole('heading', { name: 'Integration boundaries', exact: true });
  await expect(heading).toBeInViewport();
  const box = await heading.boundingBox();
  if (box === null) throw new Error('The fragment heading is missing.');
  expect(box.y).toBeGreaterThanOrEqual(95);
  expect(await heading.evaluate((element) => getComputedStyle(element).scrollMarginTop)).toBe(
    '96px',
  );
  const outline = page.getByRole('navigation', { name: 'Reference contents', exact: true });
  const introduction = outline
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: 'Reference introduction', exact: true }) });
  await expect(introduction.getByRole('listitem')).toHaveCount(2);
  const configuration = outline.getByRole('link', {
    name: 'Configuration and supported integration options',
    exact: true,
  });
  await expect(configuration).toHaveAttribute('href', '#reference-configuration');
  await configuration.click();
  await expect(page).toHaveURL(/#reference-configuration$/u);
  await expect(
    page.getByRole('heading', {
      name: 'Configuration and supported integration options',
      exact: true,
    }),
  ).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Empty outline', exact: true })).toHaveCount(0);
});

test('outline-only composition remains a single usable navigation landmark', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/documentation/');
  const outline = page.getByRole('navigation', { name: 'Minimal reference contents', exact: true });
  await expect(outline).toHaveCount(1);
  await outline.locator('summary').click();
  await outline.getByRole('link', { name: 'Minimal reference', exact: true }).click();
  await expect(page).toHaveURL(/#minimal-reference$/u);
  await expect(
    page.getByRole('heading', { name: 'Minimal reference', exact: true }),
  ).toBeInViewport();
});
