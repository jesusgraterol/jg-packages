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
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(
        await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
      ).toBe(theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      await page.getByRole('button', { name: 'default', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status')).toHaveText('Actions completed: 1');
      expect(
        await page
          .getByRole('button', { name: 'default', exact: true })
          .evaluate((button) => getComputedStyle(button).boxShadow),
      ).not.toBe('none');
      await expect(page.getByRole('button', { name: 'Unavailable' })).toBeDisabled();
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
      for (const name of ['default', 'Add item']) {
        const box = await page.getByRole('button', { name, exact: true }).boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
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
