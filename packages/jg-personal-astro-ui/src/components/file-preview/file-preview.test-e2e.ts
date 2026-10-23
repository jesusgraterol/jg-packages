import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

import { captureCopiedText } from '../copy-button/copy-button.test-utils.ts';

test('source actions copy and download real content while source scrolling stays local', async ({
  page,
}) => {
  const copied = await captureCopiedText(page);
  await page.goto('/technical-content/');
  const preview = page.getByRole('figure', { name: /^Source preview\b/u });
  const source = preview.getByRole('region', { name: 'Preview source content', exact: true });
  await source.focus();
  await expect(source).toBeFocused();
  await source.press('PageDown');
  await expect.poll(() => source.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await source.press('ArrowRight');
  await expect.poll(() => source.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  const copy = preview.getByRole('button', { name: 'Copy preview source', exact: true });
  await copy.click();
  await expect.poll(() => copied.length).toBe(1);
  expect(copied[0]).toContain('console.log(31);\n');
  const downloading = page.waitForEvent('download');
  await preview.getByRole('link', { name: 'Download', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('example.ts');
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  if (stream === null) throw new Error('The source download is unavailable.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (!Buffer.isBuffer(chunk))
      throw new Error('The source download returned an unexpected chunk.');
    chunks.push(chunk);
  }
  expect(Buffer.concat(chunks).toString('utf8')).toBe(copied[0]);
  await preview.getByRole('link', { name: 'Source', exact: true }).click();
  await expect(page).toHaveURL(/#preview-source$/u);
  await expect(page.getByText('Source link destination.', { exact: true })).toBeInViewport();
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`paths, status, source, diff, and actions fit phone and desktop in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/technical-content/');
    const example = page.locator('[data-example="file-preview"]');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      await expect(example.getByRole('link', { name: 'Download', exact: true })).toBeVisible();
      await expect(example.getByText('Modified', { exact: true })).toBeVisible();
      await expect(example.getByText('Added', { exact: true })).toBeVisible();
      await expect(
        example.getByText('Caller-supplied source and download actions.', { exact: true }),
      ).toBeVisible();
      await expect(
        example.getByText('Plain caller-supplied file content.', { exact: true }),
      ).toBeVisible();
      await expect(example.getByRole('figure', { name: /^Change preview\b/u })).toContainText(
        'const enabled = true;',
      );
      expect(
        await example
          .getByRole('region', { name: 'Preview source content', exact: true })
          .evaluate(
            (element) => element.clientHeight <= 192 && element.scrollHeight > element.clientHeight,
          ),
      ).toBe(true);
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="file-preview"]').analyze())
        .violations,
    ).toStrictEqual([]);
  });
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`phone actions in ${colorScheme}`, () => {
    test.use({ hasTouch: true, viewport: { width: 320, height: 800 }, colorScheme });
    test('touch targets fit the preview caption without clipping', async ({ page }) => {
      await page.goto('/technical-content/');
      const preview = page.getByRole('figure', { name: /^Source preview\b/u });
      const actions = preview.getByRole('button').or(preview.getByRole('link'));
      await expect(actions).toHaveCount(3);
      const sizes = await actions.evaluateAll((elements) =>
        elements.map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { width, height };
        }),
      );
      for (const size of sizes) {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('source, diff, and native actions remain available', async ({ page }) => {
    await page.goto('/technical-content/');
    const preview = page.getByRole('figure', { name: /^Source preview\b/u });
    await expect(
      preview.getByRole('region', { name: 'Preview source content', exact: true }),
    ).toContainText('console.log(31);');
    await expect(
      preview.getByRole('button', { name: 'Copy preview source', exact: true }),
    ).toHaveCount(0);
    await expect(preview.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute(
      'download',
      'example.ts',
    );
    await preview.getByRole('link', { name: 'Source', exact: true }).click();
    await expect(page).toHaveURL(/#preview-source$/u);
  });
});
