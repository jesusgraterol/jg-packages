import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`inverse palettes and compact tiles stay readable at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/foundations/');
      await waitForPageAssets(page);
      const inverse = page.getByRole('region', { name: 'Inverse section', exact: true });
      const tokens = await inverse.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          focus: style.getPropertyValue('--jg-focus').trim(),
          foreground: style.getPropertyValue('--jg-inverse-foreground').trim(),
          colorScheme: style.colorScheme,
        };
      });
      expect(tokens.focus).toBe(tokens.foreground);
      expect(tokens.colorScheme).toBe('dark');
      const field = inverse.getByRole('textbox', { name: 'Example name', exact: true });
      await field.focus();
      await expect(field).toBeFocused();
      await expect(field).toHaveCSS('font-size', '16px');
      await expect(field).toHaveCSS('outline-style', 'solid');
      const primary = inverse.getByRole('button', { name: 'Inverse primary', exact: true });
      await primary.focus();
      await expect(primary).toBeFocused();
      await expect(primary).toHaveCSS('outline-style', 'solid');
      const link = inverse.getByRole('link', { name: 'source examples', exact: true });
      await link.focus();
      await expect(link).toBeFocused();
      await expect(link).toHaveCSS('outline-style', 'solid');
      const source = inverse.getByRole('region', { name: 'Inverse source', exact: true });
      await source.focus();
      await expect(source).toBeFocused();
      await expect(source).toHaveCSS('outline-style', 'solid');
      const statuses = await Promise.all(
        ['Complete', 'Attention', 'Failed'].map((name) =>
          inverse
            .locator('[data-inverse-status]')
            .getByText(name, { exact: true })
            .evaluate((element) => getComputedStyle(element).color),
        ),
      );
      expect(new Set(statuses).size).toBe(3);
      for (const group of await page.locator('[data-compact-tiles]').all()) {
        const tiles = group.locator('[data-icon-sample]');
        await expect(tiles).toHaveCount(6);
        const colors = await tiles.evaluateAll((elements) =>
          elements.map((element) => getComputedStyle(element).color),
        );
        expect(new Set(colors).size).toBeGreaterThanOrEqual(4);
        for (const tile of await tiles.all()) {
          await expect(tile).toHaveCSS('width', '32px');
          await expect(tile).toHaveCSS('height', '32px');
          await expect(tile.locator('svg')).toHaveCSS('width', '16px');
        }
      }
      await expect(
        page.getByRole('link', { name: 'Outside section link', exact: true }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
}

test('inverse colors stay local and stable while the surrounding theme changes', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/foundations/');
  await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', 'light');
  const inverse = page.getByRole('region', { name: 'Inverse section', exact: true });
  const readColors = () =>
    inverse.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      foreground: getComputedStyle(element).color,
      body: getComputedStyle(document.body).backgroundColor,
    }));
  const light = await readColors();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-resolved-theme', 'dark');
  const dark = await readColors();
  expect(dark.background).toBe(light.background);
  expect(dark.foreground).toBe(light.foreground);
  expect(dark.body).not.toBe(light.body);
});
