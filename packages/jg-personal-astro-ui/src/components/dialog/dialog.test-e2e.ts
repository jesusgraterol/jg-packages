import { expect, test } from '@playwright/test';

test('reopening resets the body and closing restores background styles and scroll', async ({
  page,
}) => {
  await page.goto('/interactions/');
  const trigger = page.getByRole('button', { name: 'Open long dialog', exact: true });
  await trigger.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    style: document.body.getAttribute('style'),
  }));
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Long content', exact: true });
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  const body = dialog.locator('[data-dialog-body]');
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.getAttribute('style'))).toBe(before.style);
  expect(await page.evaluate(() => window.scrollY)).toBe(before.scrollY);
  await trigger.click();
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`phone dialog in ${colorScheme}`, () => {
    test.use({
      viewport: { width: 320, height: 480 },
      hasTouch: true,
      colorScheme,
      reducedMotion: 'reduce',
    });

    test('fullscreen retains its header, input sizing, and reachable actions in a short viewport', async ({
      page,
    }) => {
      await page.goto('/interactions/');
      await page.getByRole('button', { name: 'Open mobile reference', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Mobile reference', exact: true });
      const input = dialog.getByRole('textbox', { name: 'Reference note', exact: true });
      await expect(input).toBeFocused();
      await expect(input).toHaveCSS('font-size', '16px');
      await input.fill('Notes for the reference');
      expect(
        await dialog.evaluate((element) => ({
          width: element.clientWidth,
          height: element.clientHeight,
        })),
      ).toStrictEqual({ width: 320, height: 480 });
      const body = dialog.locator('[data-dialog-body]');
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(
        dialog.getByRole('heading', { name: 'Mobile reference', exact: true }),
      ).toBeInViewport();
      const close = dialog.getByRole('button', { name: 'Close', exact: true });
      await expect(close).toBeInViewport();
      expect(
        await close.evaluate((element) => element.getBoundingClientRect().height),
      ).toBeGreaterThanOrEqual(44);
      const done = dialog.getByRole('button', { name: 'Done reading', exact: true });
      await expect(done).toBeInViewport();
      await done.click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Open mobile reference', exact: true }),
      ).toBeFocused();
    });

    test('Back closes the topmost dialog and Forward never reopens it', async ({ page }) => {
      await page.goto('/interactions/');
      await page.getByRole('button', { name: 'Open mobile reference', exact: true }).click();
      const parent = page.getByRole('dialog', { name: 'Mobile reference', exact: true });
      await parent.getByRole('button', { name: 'Open nested reference', exact: true }).click();
      const child = page.getByRole('dialog', { name: 'Nested reference', exact: true });
      await expect(child).toBeVisible();
      await page.goBack();
      await expect(child).not.toBeVisible();
      await expect(parent).toBeVisible();
      await expect(page.locator('body')).toHaveCSS('position', 'fixed');
      await page.goBack();
      await expect(parent).not.toBeVisible();
      await page.goForward();
      await expect(parent).not.toBeVisible();
      await expect(child).not.toBeVisible();
      await expect(page).toHaveURL(/\/interactions\/$/u);
      await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
    });

    test('close then immediate reopen owns its new entry and navigation releases the modal', async ({
      page,
    }) => {
      await page.goto('/interactions/');
      const trigger = page.getByRole('button', { name: 'Open mobile reference', exact: true });
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Mobile reference', exact: true });
      await dialog.getByRole('button', { name: 'Close', exact: true }).evaluate((button) => {
        (button as HTMLButtonElement).click();
        document.querySelector<HTMLButtonElement>('[data-dialog-open="mobile-dialog"]')?.click();
      });
      await expect(dialog).toBeVisible();
      await page.goBack();
      await expect(dialog).not.toBeVisible();
      await trigger.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('link', { name: 'Continue browsing', exact: true }).click();
      await expect(page).toHaveURL(/\?dialog-navigation=1$/u);
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('body')).not.toHaveCSS('position', 'fixed');
      await page.getByRole('button', { name: 'Open example dialog', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Example dialog', exact: true })).toBeVisible();
    });
  });
}

test('default floating size, backdrop opt-out, Escape, and removed opener fallback remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/interactions/');
  const trigger = page.getByRole('button', { name: 'Open example dialog', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Example dialog', exact: true });
  expect(await dialog.evaluate((element) => element.getBoundingClientRect().width)).toBe(640);
  await page.mouse.click(1, 1);
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  const mobileTrigger = page.getByRole('button', { name: 'Open mobile reference', exact: true });
  await mobileTrigger.click();
  const mobile = page.getByRole('dialog', { name: 'Mobile reference', exact: true });
  expect(await mobile.evaluate((element) => element.getBoundingClientRect().width)).toBe(896);
  await page.mouse.click(1, 1);
  await expect(mobile).toBeVisible();
  await mobileTrigger.evaluate((element) => element.remove());
  await page.keyboard.press('Escape');
  await expect(mobile).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Open example dialog', exact: true }),
  ).toBeFocused();
});

test('phone fullscreen respects simulated safe-area insets', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Safe-area overrides use the Chromium DevTools Protocol.');
  const session = await context.newCDPSession(page);
  try {
    await session.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 24, bottom: 32, left: 28, right: 24 },
    });
    await page.setViewportSize({ width: 320, height: 480 });
    await page.goto('/interactions/');
    await page.getByRole('button', { name: 'Open mobile reference', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Mobile reference', exact: true });
    const heading = dialog.getByRole('heading', { name: 'Mobile reference', exact: true });
    expect(
      await heading.evaluate((element) => {
        const header = element.parentElement;
        if (header === null) throw new Error('The dialog header is missing.');
        const style = getComputedStyle(header);
        return { top: style.paddingTop, left: style.paddingLeft, right: style.paddingRight };
      }),
    ).toStrictEqual({ top: '24px', left: '28px', right: '24px' });
    await expect(dialog.locator('[data-dialog-body]')).toHaveCSS('padding-bottom', '32px');
  } finally {
    await session.send('Emulation.setSafeAreaInsetsOverride', { insets: {} });
    await session.detach();
  }
});
