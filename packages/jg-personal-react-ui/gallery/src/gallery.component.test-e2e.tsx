import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1280]) {
    test(`${theme} at ${width}px keeps the gallery accessible and within the viewport`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?theme=${theme}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await waitForPageAssets(page);
      expect(
        await page.evaluate(() =>
          [...document.fonts].some(
            (font) => font.family.includes('Ubuntu Sans Variable') && font.status === 'loaded',
          ),
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          [...document.fonts].some(
            (font) => font.family.includes('Ubuntu Sans Mono Variable') && font.status === 'loaded',
          ),
        ),
      ).toBe(true);
      await expectNoHorizontalOverflow(page);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
      ).toBe(theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      await page.getByRole('button', { name: 'default', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status', { name: 'Completed actions' })).toHaveText(
        'Actions completed: 1',
      );
      expect(
        await page
          .getByRole('button', { name: 'default', exact: true })
          .evaluate((button) => getComputedStyle(button).boxShadow),
      ).not.toBe('none');
      await expect(page.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
      await page.getByRole('button', { name: 'Try syncing again', exact: false }).focus();
      await page.keyboard.press('Space');
      await expect(page.getByRole('status', { name: 'Completed actions' })).toHaveText(
        'Actions completed: 2',
      );
      await expect(
        page.getByRole('button', { name: 'Try syncing again', exact: false }),
      ).toBeFocused();
      await page.getByRole('link', { name: 'Review notices' }).focus();
      await expect(page.getByRole('link', { name: 'Review notices' })).toBeFocused();
      expect(
        await page
          .getByRole('link', { name: 'Review notices' })
          .evaluate((link) => getComputedStyle(link).boxShadow),
      ).not.toBe('none');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/#alerts-title$/u);
      for (const size of [16, 32, 64]) {
        const image = page.getByRole('img', { name: `JG mark at ${size}px`, exact: true });
        await expect(image).toHaveJSProperty('naturalWidth', 64);
        await expect(image).toHaveCSS('width', `${size}px`);
      }
      await expect(page.getByRole('img', { name: 'JG favicon', exact: true })).toHaveJSProperty(
        'naturalWidth',
        64,
      );
      const mark = page.locator('header svg');
      await expect(mark).toHaveAttribute('aria-hidden', 'true');
      await expect(mark).toHaveAttribute('focusable', 'false');
      await expect(mark).toHaveAttribute('viewBox', '0 0 64 64');
      await expect(mark.locator('rect')).toHaveAttribute('fill', '#111827');
      await expect(mark.locator('path')).toHaveCount(2);
      const sizes = page.getByLabel('Icon tile sizes');
      for (const [size, pixels] of [
        ['sm', 32],
        ['md', 40],
        ['lg', 48],
      ] as const) {
        await expect(sizes.getByText(size, { exact: true })).toHaveCSS('width', `${pixels}px`);
        await expect(sizes.getByText(size, { exact: true })).toHaveCSS('height', `${pixels}px`);
      }
      expect(
        await page
          .getByRole('button', { name: 'default', exact: true })
          .evaluate((button) => getComputedStyle(button).transitionProperty),
      ).toBe('none');
    });
  }
}

test('system fallback follows the OS until an explicit preference is applied', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  const automatic = await page
    .getByRole('button', { name: 'outline', exact: true })
    .evaluate((button) => ({
      color: getComputedStyle(button).color,
      buttonBackground: getComputedStyle(button).backgroundColor,
      background: getComputedStyle(document.body).backgroundColor,
    }));
  await page.goto('/?theme=dark');
  const explicit = await page
    .getByRole('button', { name: 'outline', exact: true })
    .evaluate((button) => ({
      color: getComputedStyle(button).color,
      buttonBackground: getComputedStyle(button).backgroundColor,
      background: getComputedStyle(document.body).backgroundColor,
    }));
  expect(automatic).toStrictEqual(explicit);
  await page.goto('/?theme=light');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'light',
  );
});

test('coarse pointer targets stay at least 44px on phones and tablets', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 768, height: 1024 },
  });
  try {
    const page = await context.newPage();
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('http://127.0.0.1:4178/?theme=dark');
      for (const name of [
        'default',
        'Add item',
        'Try syncing again Run this action from the keyboard or by touch.',
      ]) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
      const badge = await page.getByRole('link', { name: 'Review notices' }).boundingBox();
      expect(badge?.width).toBeGreaterThanOrEqual(44);
      expect(badge?.height).toBeGreaterThanOrEqual(44);
    }
  } finally {
    await context.close();
  }
});

test('fine pointers retain the source desktop dimensions and phone minimums', async ({ page }) => {
  for (const [width, expectedSize] of [
    [320, 44],
    [768, 32],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/?theme=light');
    expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
    await expect(page.getByRole('button', { name: 'default', exact: true })).toHaveCSS(
      'height',
      `${expectedSize}px`,
    );
    await expect(page.getByRole('button', { name: 'Add item', exact: true })).toHaveCSS(
      'height',
      `${expectedSize}px`,
    );
  }
});
