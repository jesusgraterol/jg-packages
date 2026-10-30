import { expect, test } from '@playwright/test';

test('installed remote preferences confirm saves and roll back rejected changes', async ({
  page,
}) => {
  await page.goto('/?theme=light');
  const change = page.getByRole('button', { name: 'Change remote wrapping' });
  await change.click();
  await expect(page.getByRole('status', { name: 'Remote wrapping' })).toHaveText(
    'Remote wrapping: enabled',
  );
  await expect(page.getByRole('status', { name: 'Remote save' })).toHaveText('Save pending');
  await page.getByRole('button', { name: 'Confirm remote save' }).click();
  await expect(page.getByRole('status', { name: 'Remote save' })).toHaveText('Ready');
  await expect(page.getByText('Remote preferences saved', { exact: true })).toBeVisible();
  await change.click();
  await expect(page.getByRole('status', { name: 'Remote wrapping' })).toHaveText(
    'Remote wrapping: disabled',
  );
  await page.getByRole('button', { name: 'Reject remote save' }).click();
  await expect(page.getByRole('status', { name: 'Remote wrapping' })).toHaveText(
    'Remote wrapping: enabled',
  );
  await expect(
    page.getByText('We could not save your preferences. Please try again.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Private adapter diagnostic', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Wrap code' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});
