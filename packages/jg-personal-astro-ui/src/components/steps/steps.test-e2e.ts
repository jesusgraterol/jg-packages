import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test('supplied process order, numbers, and status labels retain ordered semantics', async ({
  page,
}) => {
  await page.goto('/documentation/');
  const steps = page.getByRole('list', { name: 'Release preparation', exact: true });
  expect(await steps.evaluate((list) => list.tagName)).toBe('OL');
  expect(
    await steps
      .getByRole('article')
      .evaluateAll((items) => items.map((item) => item.getAttribute('aria-label'))),
  ).toStrictEqual(['Inspect source', 'Verify output', 'Publish later', 'Recover failure']);
  for (const number of ['01', '2', '04'])
    await expect(steps.getByText(number, { exact: true })).toBeVisible();
  for (const status of ['Pending', 'Current', 'Complete', 'Error'])
    await expect(steps.getByText(status, { exact: true })).toBeVisible();
  await expect(steps.locator('[aria-current="step"]')).toHaveCount(1);
  await expect(steps.locator('[aria-current="step"]')).toContainText('Verify output');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`process connectors, long text, and supplied actions fit in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/documentation/');
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      await expect(
        page.getByText(
          'averylongunbrokenstepdescriptionthatmustwraponanarrowphonewithoutoverflow',
          { exact: true },
        ),
      ).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="steps"]').analyze()).violations,
    ).toStrictEqual([]);
  });
}
