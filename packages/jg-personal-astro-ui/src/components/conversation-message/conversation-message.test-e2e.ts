import { expect, test } from '@playwright/test';

import { captureCopiedText } from '../copy-button/copy-button.test-utils.ts';

test('an artifact copies the supplied original source through its message', async ({ page }) => {
  const copied = await captureCopiedText(page);
  await page.goto('/technical-content/');
  const message = page.getByRole('article', { name: 'Review assistant (Assistant)', exact: true });
  await expect(
    message.getByText('The source preserves its original line endings and final newline.', {
      exact: true,
    }),
  ).toBeVisible();
  await message.getByRole('button', { name: 'Copy conversation artifact', exact: true }).click();
  await expect
    .poll(() => copied.at(-1))
    .toBe('export const ready = true;\r\nconsole.log("Hello, 世界");\r\n');
  expect(copied).toHaveLength(1);
});

test('missing optional slots and role preserve a readable named message', async ({ page }) => {
  await page.goto('/technical-content/');
  const transcript = page.getByRole('list', { name: 'Minimal example', exact: true });
  const message = transcript.getByRole('article', { name: 'Reviewer', exact: true });
  await expect(message).toHaveCount(1);
  await expect(
    message.getByText('A minimal message without optional slots or a role.', { exact: true }),
  ).toBeVisible();
  await expect(message.getByRole('figure')).toHaveCount(0);
  await expect(message.getByRole('img')).toHaveCount(0);
  await expect(transcript.getByRole('article')).toHaveCount(1);
});
