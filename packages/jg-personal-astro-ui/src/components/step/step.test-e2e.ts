import { expect, test } from '@playwright/test';

test('title/content slots and missing optional fields preserve readable steps', async ({
  page,
}) => {
  await page.goto('/documentation/');
  const rich = page.getByRole('article', { name: 'Verify output', exact: true });
  await expect(rich.getByText('Supplied metadata', { exact: true })).toBeVisible();
  await expect(
    rich.getByText('averylongunbrokenstepdescriptionthatmustwraponanarrowphonewithoutoverflow', {
      exact: true,
    }),
  ).toBeVisible();
  const minimal = page.getByRole('list', { name: 'Minimal process', exact: true });
  await expect(minimal.getByRole('listitem')).toHaveCount(1);
  await expect(
    minimal.getByRole('article', { name: 'No optional fields', exact: true }),
  ).toBeVisible();
  await expect(minimal.getByRole('link')).toHaveCount(0);
  await expect(minimal.locator('[aria-current]')).toHaveCount(0);
});

test('a keyboard action reaches its heading below the sticky site header', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/documentation/');
  const action = page.getByRole('link', { name: 'Inspect conversation example', exact: true });
  await action.focus();
  await action.press('Enter');
  await expect(page).toHaveURL(/\/technical-content\/#conversation-title$/u);
  const heading = page.getByRole('heading', { name: 'Conversations and artifacts', exact: true });
  await expect(heading).toBeInViewport();
  const position = await heading.evaluate((target) => {
    const banner = target.ownerDocument.querySelector('header');
    if (banner === null) throw new Error('The site header is missing.');
    return {
      targetTop: target.getBoundingClientRect().top,
      headerBottom: banner.getBoundingClientRect().bottom,
    };
  });
  expect(position.targetTop).toBeGreaterThanOrEqual(position.headerBottom);
});
