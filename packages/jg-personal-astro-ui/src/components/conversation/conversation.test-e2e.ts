import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test('a labelled ordered transcript preserves supplied speaker and role order', async ({
  page,
}) => {
  await page.goto('/technical-content/');
  const transcript = page.getByRole('list', { name: 'Development example', exact: true });
  expect(await transcript.evaluate((list) => list.tagName)).toBe('OL');
  const speakers = [
    'Jordan Gray (User)',
    'Review assistant (Assistant)',
    'Session context (System)',
    'Execution service (Tool)',
  ];
  await expect(transcript.getByRole('article')).toHaveCount(4);
  expect(
    await transcript
      .getByRole('article')
      .evaluateAll((messages) => messages.map((message) => message.getAttribute('aria-label'))),
  ).toStrictEqual(speakers);
  expect(
    await transcript.evaluate((list) => [...list.children].map((child) => child.tagName)),
  ).toStrictEqual(['LI', 'LI', 'LI', 'LI']);
  await expect(page.getByRole('heading', { name: 'Source to result', exact: true })).toBeVisible();
  await expect(page.getByText('End of example transcript.', { exact: true })).toBeVisible();
  const userMessage = transcript.getByRole('article', { name: 'Jordan Gray (User)', exact: true });
  await expect(userMessage.getByText('JG', { exact: true })).toBeVisible();
  await expect(userMessage.locator('time')).toHaveAttribute('datetime', '2026-10-22T10:32:00Z');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`long messages, custom avatars, and full-width artifacts fit in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/technical-content/');
    const transcript = page.getByRole('list', { name: 'Development example', exact: true });
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await expectNoHorizontalOverflow(page);
      await expect(
        transcript.getByText(
          'averylongunbrokenconversationidentifierthatmustwraponanarrowviewportwithoutclipping',
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        transcript.getByRole('figure', { name: /^Conversation source\b/u }),
      ).toBeVisible();
      await expect(
        transcript.getByRole('figure', { name: 'Conversation files', exact: true }),
      ).toBeVisible();
    }
    expect(
      (await new AxeBuilder({ page }).include('[data-example="conversation"]').analyze())
        .violations,
    ).toStrictEqual([]);
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('the complete transcript and artifacts remain readable', async ({ page }) => {
    await page.goto('/technical-content/');
    const transcript = page.getByRole('list', { name: 'Development example', exact: true });
    await expect(transcript.getByRole('article')).toHaveCount(4);
    await expect(
      transcript.getByRole('region', { name: 'Conversation artifact source', exact: true }),
    ).toContainText('Hello, 世界');
    await expect(
      transcript.getByRole('figure', { name: 'Conversation files', exact: true }),
    ).toContainText('stable.ts');
    await expect(
      transcript.getByRole('button', { name: 'Copy conversation artifact', exact: true }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
