import { expect, test } from '@playwright/test';

test('machine-readable dates are explicit and display-only dates are not inferred', async ({
  page,
}) => {
  await page.goto('/documentation/');
  const review = page.getByRole('article', { name: 'Release review', exact: true });
  await expect(review.locator('time')).toHaveAttribute('datetime', '2026-10-23');
  await expect(review.locator('time')).toHaveText('October 23, 2026');
  await expect(review.getByText('Supplied metadata', { exact: true })).toBeVisible();
  const later = page.getByRole('article', { name: 'Next iteration', exact: true });
  await expect(later.getByText('Later', { exact: true })).toBeVisible();
  await expect(later.locator('time')).toHaveCount(0);
  const minimal = page.getByRole('article', { name: 'Undated entry', exact: true });
  await expect(minimal.getByText('Supplied display date', { exact: true })).toBeVisible();
  await expect(minimal.locator('time')).toHaveCount(0);
  await expect(minimal.getByRole('link')).toHaveCount(0);
});

test('a supplied timeline action remains keyboard operable', async ({ page }) => {
  await page.goto('/documentation/');
  const action = page
    .getByRole('article', { name: 'Release review', exact: true })
    .getByRole('link', { name: 'Inspect process steps', exact: true });
  await action.focus();
  await expect(action).toBeFocused();
  expect(await action.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    'none',
  );
  await action.press('Enter');
  await expect(page).toHaveURL(/#steps-title$/u);
});
