import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`reading grid and labelled landmarks adapt without duplicate content in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/documentation/');
    const shell = page.locator('[data-example="documentation-shell"]');
    const pages = shell.getByRole('navigation', { name: 'Reference pages', exact: true });
    const outline = shell.getByRole('navigation', { name: 'Reference contents', exact: true });
    const introduction = shell.getByRole('heading', {
      name: 'Reference introduction',
      exact: true,
    });
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(pages).toHaveCount(1);
    await expect(outline).toHaveCount(1);
    await expect(introduction).toHaveCount(1);
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      if (width === 320) {
        await pages.locator('summary').click();
        await outline.locator('summary').click();
      }
      await expect(
        pages.getByRole('link', { name: 'Documentation and component composition', exact: true }),
      ).toHaveAttribute('aria-current', 'page');
      await expect(
        pages.getByRole('link', { name: 'Foundations and shared design tokens', exact: true }),
      ).not.toHaveAttribute('aria-current');
      await expect(pages.getByText('Empty group', { exact: true })).toHaveCount(0);
      const [navigationBox, outlineBox, contentBox] = await shell.evaluate((wrapper) =>
        [
          wrapper.querySelector('nav[aria-label="Reference pages"]'),
          wrapper.querySelector('nav[aria-label="Reference contents"]'),
          wrapper.querySelector('#reference-introduction'),
        ].map((element) => {
          if (element === null) throw new Error('Documentation layout is missing.');
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        }),
      );
      if (navigationBox === undefined || outlineBox === undefined || contentBox === undefined)
        throw new Error('Documentation layout is not visible.');
      if (width >= 1024) {
        expect(navigationBox.right).toBeLessThanOrEqual(contentBox.left);
        expect(contentBox.right).toBeLessThanOrEqual(outlineBox.left);
      } else {
        expect(navigationBox.bottom).toBeLessThanOrEqual(outlineBox.top);
        expect(outlineBox.bottom).toBeLessThanOrEqual(contentBox.top);
      }
      await expectNoHorizontalOverflow(page);
    }
    await expect(
      page.getByRole('navigation', { name: 'Empty reference pages', exact: true }),
    ).toHaveCount(0);
    const unselected = page.getByRole('navigation', {
      name: 'Unselected reference pages',
      exact: true,
    });
    await expect(unselected.locator('[aria-current]')).toHaveCount(0);
    await expect(
      page.getByText('A frame without navigation or an outline.', { exact: true }),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('[data-example="documentation-shell"]').analyze())
        .violations,
    ).toStrictEqual([]);
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('page groups and an outline remain keyboard-accessible disclosures', async ({ page }) => {
    await page.goto('/documentation/');
    const navigation = page.getByRole('navigation', { name: 'Reference pages', exact: true });
    const summary = navigation.locator('summary');
    await summary.focus();
    await summary.press('Enter');
    const current = navigation.getByRole('link', {
      name: 'Documentation and component composition',
      exact: true,
    });
    await expect(current).toBeVisible();
    await summary.press('Tab');
    const first = navigation.getByRole('link', {
      name: 'Foundations and shared design tokens',
      exact: true,
    });
    await expect(first).toBeFocused();
    expect(await first.evaluate((link) => getComputedStyle(link).outlineStyle)).not.toBe('none');
    const outline = page.getByRole('navigation', { name: 'Reference contents', exact: true });
    await outline.locator('summary').focus();
    await outline.locator('summary').press(' ');
    await outline.getByRole('link', { name: 'Integration boundaries', exact: true }).click();
    await expect(page).toHaveURL(/#reference-boundaries$/u);
    await expect(
      page.getByRole('heading', { name: 'Integration boundaries', exact: true }),
    ).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  });
});
