import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

import { captureCopiedText } from '../copy-button/copy-button.test-utils.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`summary tones, explicit heading levels, and slots remain readable in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/documentation/');
    const examples = page.locator('[data-example="result-summary"]');
    for (const title of ['Neutral result', 'Successful result', 'Review warning', 'Failed result'])
      await expect(
        examples.getByRole('heading', { name: title, level: 3, exact: true }),
      ).toBeVisible();
    for (const label of ['Summary', 'Success', 'Warning', 'Danger', 'Reviewed'])
      await expect(examples.getByText(label, { exact: true })).toBeVisible();
    await expect(
      examples.getByRole('heading', { name: 'Nested summary', level: 4, exact: true }),
    ).toBeVisible();
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      await expect(
        examples.getByText(
          'averylongunbrokenresultdescriptionthatmustremainreadableonanarrowphoneviewport',
          { exact: true },
        ),
      ).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="result-summary"]').analyze())
        .violations,
    ).toStrictEqual([]);
    await examples.getByRole('link', { name: 'Inspect file example', exact: true }).click();
    await expect(page).toHaveURL(/\/technical-content\/#file-preview-title$/u);
  });
}

test('source/results, raw/copy/download actions, metadata, tables, and supplied marks compose', async ({
  page,
}) => {
  const source = "export const greeting = 'Hello from Astro UI';\n";
  const copied = await captureCopiedText(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/technical-content/');
  const recipe = page.locator('[data-source-result-recipe]');
  for (const caption of ['Recipe source', 'examples/hello.txt']) {
    expect(
      await recipe.getByText(caption, { exact: true }).evaluate((element) => {
        const range = element.ownerDocument.createRange();
        range.selectNodeContents(element);
        return range.getClientRects().length;
      }),
    ).toBe(1);
  }
  const tabs = recipe.getByRole('tablist', { name: 'Source and result', exact: true });
  await expect(tabs.getByRole('tab', { name: 'Source', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await recipe.getByRole('button', { name: 'Copy recipe source', exact: true }).click();
  await expect.poll(() => copied.at(-1)).toBe(source);
  const response = await page.request.get('/examples/hello.txt');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toBe(source);
  const downloading = page.waitForEvent('download');
  await recipe.getByRole('link', { name: 'Download', exact: true }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('hello.txt');
  expect(await download.failure()).toBeNull();
  expect(new URL(download.url()).pathname).toBe('/examples/hello.txt');
  await expect(
    recipe.getByRole('region', { name: 'Artifact metadata', exact: true }),
  ).toContainText('TypeScript');
  await expect(
    recipe.getByRole('table', { name: 'Source and result comparison', exact: true }),
  ).toBeVisible();
  await expect(recipe.getByText('JG reference', { exact: true })).toBeVisible();
  await expect(recipe.getByText('Agentic Coding', { exact: true })).toBeVisible();
  await tabs.getByRole('tab', { name: 'Result', exact: true }).click();
  await expect(
    recipe.getByRole('heading', { name: 'Example result', level: 3, exact: true }),
  ).toBeVisible();
  await expect(
    recipe.getByRole('region', { name: 'Recipe source content', exact: true }),
  ).toBeHidden();
  await recipe.getByRole('link', { name: 'Inspect raw source', exact: true }).click();
  await expect(page).toHaveURL('/examples/hello.txt');
  await expect(page.locator('body')).toContainText(
    "export const greeting = 'Hello from Astro UI';",
  );
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('source and result panels retain native raw and download actions', async ({ page }) => {
    await page.goto('/technical-content/');
    const recipe = page.locator('[data-source-result-recipe]');
    await expect(
      recipe.getByRole('region', { name: 'Recipe source content', exact: true }),
    ).toBeVisible();
    await expect(
      recipe.getByRole('heading', { name: 'Example result', exact: true }),
    ).toBeVisible();
    await expect(
      recipe.getByRole('button', { name: 'Copy recipe source', exact: true }),
    ).toHaveCount(0);
    await expect(recipe.getByRole('link', { name: 'Download', exact: true })).toHaveAttribute(
      'download',
      'hello.txt',
    );
    await recipe.getByRole('link', { name: 'Raw', exact: true }).click();
    await expect(page).toHaveURL('/examples/hello.txt');
  });
});
