import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test('a labelled timeline preserves supplied order and explicit statuses', async ({ page }) => {
  await page.goto('/documentation/');
  const timeline = page.getByRole('list', { name: 'Release history', exact: true });
  expect(await timeline.evaluate((list) => list.tagName)).toBe('OL');
  expect(
    await timeline
      .getByRole('article')
      .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label'))),
  ).toStrictEqual(['Release review', 'Implementation', 'Next iteration', 'Recovery example']);
  for (const status of ['Pending', 'Current', 'Complete', 'Error'])
    await expect(timeline.getByText(status, { exact: true })).toBeVisible();
  await expect(timeline.locator('[aria-current="true"]')).toHaveCount(1);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`dates and responsive timeline connectors fit in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/documentation/');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      await expect(
        page.getByText(
          'averylongunbrokentimelinedescriptionthatmustwraponanarrowphonewithoutoverflow',
          { exact: true },
        ),
      ).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="timeline"]').analyze()).violations,
    ).toStrictEqual([]);
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('process and timeline content remains available in supplied order', async ({ page }) => {
    await page.goto('/documentation/');
    await expect(
      page.getByRole('list', { name: 'Release history', exact: true }).getByRole('article'),
    ).toHaveCount(4);
    await expect(
      page.getByRole('list', { name: 'Release preparation', exact: true }).getByRole('article'),
    ).toHaveCount(4);
    await page.getByRole('link', { name: 'Inspect process steps', exact: true }).click();
    await expect(page).toHaveURL(/#steps-title$/u);
    await expect(
      page.getByRole('heading', { name: 'Supplied process steps', exact: true }),
    ).toBeInViewport();
  });
});
