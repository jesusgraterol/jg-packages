import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

test('a final-newline change is represented instead of disappearing as unchanged context', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/technical-content/');
  const example = page.locator('[data-diff-newline]');
  await expect(
    example.getByText('No newline at end of file', { exact: true }).first(),
  ).toBeVisible();
});

for (const colorScheme of ['light', 'dark'] as const) {
  for (const width of [320, 1280]) {
    test(`diff options preserve readable aligned source at ${width}px in ${colorScheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/technical-content/');
      await waitForPageAssets(page);
      const context = page.locator('[data-diff-context]');
      const unified = context.getByRole('group', {
        name: 'Changes from Original source to Updated source',
        exact: true,
      });
      await expect(unified).toBeVisible();
      await expect(unified.getByText('2 unchanged lines omitted', { exact: true })).toHaveCount(2);
      await expect(unified.locator('[data-diff-kind="removed"] .jg-diff-number')).toHaveText([
        '4',
        '',
      ]);
      await expect(
        unified.locator('[data-diff-kind="added"]').first().locator('.jg-diff-number'),
      ).toHaveText(['', '4']);
      expect(await unified.locator('mark').count()).toBeGreaterThan(0);
      const wrap = page.getByRole('group', {
        name: 'Changes from Long original source to Short updated source side by side',
        exact: true,
      });
      await expect(wrap).toBeVisible();
      const before = wrap.locator('[data-diff-kind="removed"]').filter({ hasText: 'old Unicode' });
      const after = wrap.locator('[data-diff-kind="added"]').filter({ hasText: 'new 🌍' });
      const left = await before.boundingBox();
      const right = await after.boundingBox();
      expect(left).not.toBeNull();
      expect(right).not.toBeNull();
      expect(left?.y).toBe(right?.y);
      expect(left?.height).toBe(right?.height);
      expect(await wrap.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      const scroll = page.getByRole('group', { name: 'Scrollable original source', exact: true });
      await scroll.focus();
      await expect(scroll).toBeFocused();
      await expect(scroll).toHaveCSS('outline-style', 'solid');
      await scroll.press('ArrowRight');
      await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      const plain = page.locator('[data-diff-plain]').getByRole('figure');
      await expect(plain).toHaveCSS('border-top-width', '0px');
      await expect(plain).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      expect(
        await plain
          .locator('code')
          .evaluateAll((elements) =>
            elements.every((element) => getComputedStyle(element).borderTopWidth === '0px'),
          ),
      ).toBe(true);
      await expect(
        page.locator('[data-diff-empty]').getByText('No changes.', { exact: true }),
      ).toBeVisible();
      const defaults = page.locator('[data-example="code-diff"]');
      const defaultUnified = defaults.getByRole('group', {
        name: 'Changes from Before to After',
        exact: true,
        includeHidden: true,
      });
      if (width === 320) await expect(defaultUnified).toBeVisible();
      else await expect(defaultUnified).toBeHidden();
      await expectNoHorizontalOverflow(page);
    });
  }
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('line numbers, context notices, and word emphasis are build-time content', async ({
    page,
  }) => {
    await page.goto('/technical-content/');
    const example = page.locator('[data-diff-context]');
    await expect(
      example.getByRole('group', {
        name: 'Changes from Original source to Updated source',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      example.getByText('2 unchanged lines omitted', { exact: true }).first(),
    ).toBeVisible();
    expect(await example.locator('mark').count()).toBeGreaterThan(0);
  });
});
