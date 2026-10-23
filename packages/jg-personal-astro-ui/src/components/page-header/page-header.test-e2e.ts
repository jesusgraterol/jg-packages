import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`title options and metadata preserve their scope at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/documentation/');
      await waitForPageAssets(page);
      const original = page.getByRole('heading', { name: 'Documentation', exact: true });
      await expect(original).toHaveCSS('font-size', width === 320 ? '32px' : '56px');
      await expect(original).toHaveCSS('font-family', /Ubuntu Sans Variable/);
      await expect(original).toHaveCSS('font-weight', '700');
      const example = page.getByRole('region', { name: 'Document header options', exact: true });
      const title = example.getByRole('heading', { name: 'Astro component API', exact: true });
      await expect(title).toHaveCSS('font-size', width === 320 ? '28px' : '40px');
      await expect(title).toHaveCSS('font-family', /Ubuntu Sans Mono Variable/);
      await expect(example.getByText('Updated October 22, 2026', { exact: true })).toBeVisible();
      await expect(example.getByText('API reference', { exact: true })).toBeVisible();
      await expect(example.locator('svg').first()).toBeVisible();
      const action = example.getByRole('link', { name: 'Read source examples', exact: true });
      await expect(action).toBeVisible();
      const metadataBounds = await example
        .getByText('Updated October 22, 2026', { exact: true })
        .boundingBox();
      const actionBounds = await action.boundingBox();
      expect(metadataBounds).not.toBeNull();
      expect(actionBounds).not.toBeNull();
      expect(actionBounds?.y).toBeGreaterThan(
        (metadataBounds?.y ?? 0) + (metadataBounds?.height ?? 0),
      );
      await action.focus();
      await expect(action).toBeFocused();
      await expect(action).toHaveCSS('outline-style', 'solid');
      const prose = page.locator('[data-document-prose]');
      await expect(
        prose.getByRole('heading', { name: 'Component reference headings', exact: true }),
      ).toHaveCSS('font-size', width === 320 ? '28px' : '40px');
      await expect(
        prose.getByRole('heading', { name: 'Document section heading', exact: true }),
      ).toHaveCSS('font-family', /Ubuntu Sans Mono Variable/);
      await expect(
        prose.getByText('Document body copy retains the sans font while headings can use mono.', {
          exact: true,
        }),
      ).toHaveCSS('font-family', /Ubuntu Sans Variable/);
      const nested = prose.getByRole('heading', { name: 'Nested sans heading', exact: true });
      await expect(nested).toHaveCSS('font-family', /Ubuntu Sans Variable/);
      await expect(nested).toHaveCSS('margin-top', '0px');
      await expect(prose.locator('[data-after-nested]')).toHaveCSS(
        'font-family',
        /Ubuntu Sans Variable/,
      );
      await expectNoHorizontalOverflow(page);
    });
  }
}
