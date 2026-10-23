import { expect, test } from '@playwright/test';

import { captureCopiedText } from './copy-button.test-utils.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  test(`icon controls copy through every producer in ${colorScheme}`, async ({ page }) => {
    const copied = await captureCopiedText(page);
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/technical-content/');
    const source = 'const message = "Hola, 世界 <Astro> & friends";\nconsole.log(message);';
    const cases = [
      ['[data-example="code-block"]', 'Copy code', source],
      ['[data-example="install-command"]', 'Copy compact install command', 'pnpm add jg-site'],
      ['[data-example="terminal-window"]', 'Copy compact terminal output', source],
      ['[data-icon-markdown-example]', 'Copy code', source],
    ] as const;
    for (const [selector, name, expected] of cases) {
      const button = page.locator(selector).locator('[data-copy-display="icon"]');
      await expect(button).toHaveAccessibleName(name);
      await button.focus();
      await expect(button).toBeFocused();
      await expect(button).toHaveCSS('outline-style', 'solid');
      const resting = await button.boundingBox();
      await button.press('Enter');
      await expect(button).toHaveAttribute('data-copy-state', 'success');
      expect(copied.at(-1)).toBe(expected);
      const outcome = await button.boundingBox();
      expect(outcome?.width).toBe(resting?.width);
      expect(outcome?.height).toBe(resting?.height);
      expect(resting?.width).toBe(32);
    }
    await page.goto('/interactions/');
    const commands = page.locator('[data-icon-package-manager]');
    const command = commands.locator('[data-copy-display="icon"]:visible');
    await command.click();
    await expect(command).toHaveAttribute('data-copy-state', 'success');
    expect(copied.at(-1)).toBe('npm install --save-dev jg-playwright');
    await commands.getByRole('tab', { name: 'pnpm', exact: true }).click();
    await command.click();
    await expect.poll(() => copied.at(-1)).toBe('pnpm add --save-dev jg-playwright');
    for (const context of ['Unicode example', 'Unicode document']) {
      const button = page.locator(`[data-copy-button][data-copy-context="${context}"]`);
      await expect(button).toHaveAccessibleName(`Copy ${context}`);
      await button.click();
      await expect(button).toHaveAttribute('data-copy-state', 'success');
      expect(copied.at(-1)).toBe('Hola, 世界 <Astro> & friends\nSecond line\n');
    }
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('code and Markdown remain readable without inactive copy controls', async ({ page }) => {
    await page.goto('/technical-content/');
    await expect(page.getByText('A real Markdown code fence:', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Copy/u })).toHaveCount(0);
    await page.goto('/interactions/');
    await expect(page.getByRole('button', { name: /^Copy/u })).toHaveCount(0);
  });
});

test.describe('touch controls', () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 400 } });

  test('compact window actions retain a full touch target', async ({ page }) => {
    await page.goto('/technical-content/');
    const button = page
      .locator('[data-icon-markdown-example]')
      .getByRole('button', { name: 'Copy code', exact: true });
    await expect(button).toBeVisible();
    const bounds = await button.boundingBox();
    expect(bounds?.width).toBe(44);
    expect(bounds?.height).toBe(44);
  });
});

test('copy failure guidance fits a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }),
  );
  await page.goto('/interactions/');
  await page.getByRole('button', { name: 'Copy missing example', exact: true }).click();
  const hint = page.locator('[data-copy-hint]:visible');
  await expect(hint).toHaveCount(1);
  await expect
    .poll(async () => {
      const bounds = await hint.boundingBox();
      return bounds !== null && bounds.x >= 0 && bounds.x + bounds.width <= 320;
    })
    .toBe(true);
});
