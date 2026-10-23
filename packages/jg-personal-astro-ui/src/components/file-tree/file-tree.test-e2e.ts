import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test('bounded previews retain semantic hierarchy and report omissions honestly', async ({
  page,
}) => {
  await page.goto('/technical-content/');
  const project = page.getByRole('figure', { name: 'Project files', exact: true });
  await expect(project.getByRole('listitem')).toHaveCount(5);
  await expect(project.getByRole('tree')).toHaveCount(0);
  for (const status of ['Added', 'Modified', 'Removed', 'Unchanged'])
    await expect(project.getByText(status, { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('figure', { name: 'Empty file preview', exact: true })
      .getByText('No files to preview.', { exact: true }),
  ).toBeVisible();
  const deep = page.getByRole('figure', { name: 'Deep file preview', exact: true });
  await expect(deep.getByRole('listitem')).toHaveCount(8);
  await expect(deep.getByText('directory-9-with-a-long-name', { exact: true })).toHaveCount(0);
  const cyclic = page.getByRole('figure', { name: 'Cyclic file preview', exact: true });
  await expect(cyclic.getByRole('listitem')).toHaveCount(2);
  await page.getByText('Show wide file preview', { exact: true }).click();
  const wide = page.getByRole('figure', { name: 'Wide file preview', exact: true });
  await expect(wide.getByRole('listitem')).toHaveCount(256);
  await expect(wide.getByText('entry-255.ts', { exact: true })).toBeVisible();
  await expect(wide.getByText('entry-256.ts', { exact: true })).toHaveCount(0);
  for (const partial of [deep, cyclic, wide])
    await expect(
      partial.getByText('Partial preview. Some entries are not shown.', { exact: true }),
    ).toBeVisible();
  await expect(
    project.getByText('Partial preview. Some entries are not shown.', { exact: true }),
  ).toHaveCount(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`long names and eight nested levels remain readable in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/technical-content/');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      const project = page.getByRole('figure', { name: 'Project files', exact: true });
      const link = project.getByRole('link', {
        name: 'configuration-with-a-very-long-name-世界.ts',
        exact: true,
      });
      await expect(link).toHaveAttribute('href', '#preview-source');
      await link.focus();
      await link.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(link).toBeFocused();
      expect(await link.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
        'none',
      );
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="file-tree"]').analyze()).violations,
    ).toStrictEqual([]);
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('file and directory links remain native anchors', async ({ page }) => {
    await page.goto('/technical-content/');
    const project = page.getByRole('figure', { name: 'Project files', exact: true });
    const file = project.getByRole('link', {
      name: 'configuration-with-a-very-long-name-世界.ts',
      exact: true,
    });
    await file.focus();
    await file.press('Enter');
    await expect(page).toHaveURL(/#preview-source$/u);
    await expect(page.getByText('Source link destination.', { exact: true })).toBeInViewport();
    await project.getByRole('link', { name: 'empty-directory', exact: true }).click();
    await expect(page).toHaveURL(/#file-tree-title$/u);
  });
});
