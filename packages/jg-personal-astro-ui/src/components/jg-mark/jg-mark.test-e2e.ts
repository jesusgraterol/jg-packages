import { expect, test } from '@playwright/test';
import { waitForPageAssets } from 'jg-playwright';
import { JG_MARK_PATHS, JG_MARK_TILE, JG_MARK_VIEW_BOX } from 'jg-personal-ui/brand';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`the shared mark retains canonical geometry and decorative behavior at ${width}px in ${colorScheme}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/foundations/');
      await waitForPageAssets(page);
      // decorative SVG geometry is inspected through the gallery's existing artifact marker.
      const mark = page.locator('[data-example="jg-mark"] svg');
      await expect(mark).toHaveAttribute('viewBox', JG_MARK_VIEW_BOX);
      await expect(mark).toHaveAttribute('aria-hidden', 'true');
      await expect(mark).toHaveAttribute('focusable', 'false');
      for (const [attribute, value] of Object.entries(JG_MARK_TILE)) {
        await expect(mark.locator('rect')).toHaveAttribute(attribute, String(value));
      }
      await expect(mark.locator('path')).toHaveCount(JG_MARK_PATHS.length);
      for (const [index, path] of JG_MARK_PATHS.entries()) {
        await expect(mark.locator('path').nth(index)).toHaveAttribute('d', path.d);
        await expect(mark.locator('path').nth(index)).toHaveAttribute('fill', path.fill);
      }
      expect(
        await mark.evaluate((svg) => [...svg.children].map((child) => child.tagName)),
      ).toStrictEqual(['rect', 'path', 'path']);
      for (const size of [16, 32, 64]) {
        await mark.evaluate((svg, pixels) => {
          svg.style.width = `${pixels}px`;
          svg.style.height = `${pixels}px`;
        }, size);
        await expect(mark).toHaveCSS('width', `${size}px`);
        await expect(mark).toHaveCSS('height', `${size}px`);
        if (width === 320 && testInfo.project.name === 'chromium') {
          await mark.screenshot({
            path: testInfo.outputPath(`jg-mark-${colorScheme}-${size}.png`),
          });
        }
      }
    });
  }
}
