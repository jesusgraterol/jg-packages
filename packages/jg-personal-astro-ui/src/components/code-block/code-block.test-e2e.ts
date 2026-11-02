import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

import { captureCopiedText } from '../copy-button/copy-button.test-utils.ts';

test('copy preserves the original source, including CRLF and the final newline', async ({
  page,
}) => {
  const copied = await captureCopiedText(page);
  await page.goto('/technical-content/');
  const block = page.locator('[data-source-fidelity]');
  const buttons = block.locator('[data-copy-button]');
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) {
    await expect(button).toHaveAccessibleName('Copy code');
    await button.click();
    await expect
      .poll(() => copied.at(-1))
      .toBe('const greeting = "世界";\r\nconsole.log("<tag> & text");\r\n');
    await expect(button).toHaveAttribute('data-copy-state', 'success');
  }
  expect(copied).toHaveLength(2);
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(
      `source bodies own dimensions and keyboard scrolling at ${width}px in ${colorScheme}`,
      { tag: '@full' },
      async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/technical-content/');
        await waitForPageAssets(page);
        const scroll = page.getByRole('region', { name: 'Scrollable source', exact: true });
        await expect(scroll).toHaveAttribute('tabindex', '0');
        await expect(scroll).toHaveCSS('height', '160px');
        await expect(scroll).toHaveCSS('font-size', width >= 640 ? '14px' : '13px');
        await expect(scroll).toHaveCSS('white-space', 'pre');
        await scroll.focus();
        await expect(scroll).toBeFocused();
        await expect(scroll).toHaveCSS('outline-style', 'solid');
        await scroll.press('PageDown');
        await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await scroll.press('ArrowRight');
        await expect
          .poll(() => scroll.evaluate((element) => element.scrollLeft))
          .toBeGreaterThan(0);
        const wrap = page.getByRole('region', { name: 'Wrapped source', exact: true });
        await expect(wrap).toHaveCSS('max-height', '192px');
        await expect(wrap).toHaveCSS('height', '192px');
        await expect(wrap).toHaveCSS('white-space', 'pre-wrap');
        expect(await wrap.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        const plain = page.getByRole('region', { name: 'Plain source', exact: true });
        await expect(plain).toHaveCSS('height', '160px');
        await expect(page.locator('[data-plain-code] figure')).toHaveCSS('border-top-width', '0px');
        await expect(page.locator('[data-plain-code] figure')).toHaveCSS('box-shadow', 'none');
        await expect(page.locator('[data-plain-code] figure')).toHaveCSS(
          'background-color',
          'rgba(0, 0, 0, 0)',
        );
        await plain.focus();
        await expect(plain).toBeFocused();
        await expect(plain).toHaveCSS('outline-style', 'solid');
        expect(await plain.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        await expect(page.locator('[data-plain-empty-code] figcaption')).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Empty source', exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(page);
      },
    );
  }
}
