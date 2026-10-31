import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test(
  'consumer inline button colors retain precedence while hovered in dark mode',
  { tag: '@full' },
  async ({ page }) => {
    await page.goto('/?theme=dark');
    const button = page.getByRole('button', { name: 'default', exact: true });
    await button.evaluate((element) => {
      element.style.color = 'rgb(110, 231, 183)';
      element.style.backgroundColor = 'rgb(17, 24, 39)';
    });
    await button.hover();
    await expect(button).toHaveCSS('color', 'rgb(110, 231, 183)');
  },
);

test(
  'the head script applies its custom stored namespace before application JavaScript runs',
  { tag: '@full' },
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => {
      localStorage.setItem('jg-storage:jg-ui-gallery', JSON.stringify({ theme: 'dark' }));
      localStorage.setItem('jg-storage:jg-ui-preferences', JSON.stringify({ theme: 'light' }));
    });
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveClass('dark');
    expect(await page.locator('#root').textContent()).toBe('');
  },
);

test(
  'theme and wrapping controls persist through a reload in the gallery namespace',
  { tag: '@full' },
  async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to dark theme' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Current theme')).toHaveText('dark');
    await page.getByRole('button', { name: 'Wrap code' }).click();
    await expect(page.getByRole('button', { name: 'Wrap code' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      await page.evaluate((): unknown =>
        JSON.parse(localStorage.getItem('jg-storage:jg-ui-gallery') ?? '{}'),
      ),
    ).toMatchObject({ theme: 'dark', prefersWrappedCode: true });
    expect(
      await page.evaluate(() => localStorage.getItem('jg-storage:jg-ui-preferences')),
    ).toBeNull();
    await page.reload();
    await expect(page.getByLabel('Current theme')).toHaveText('dark');
    await expect(page.getByRole('button', { name: 'Wrap code' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('html')).toHaveClass('dark');
  },
);

for (const theme of ['light', 'dark'] as const) {
  test(
    `${theme} notifications wrap at 320px, expose keyboard actions, and honor reduced motion`,
    { tag: '@full' },
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/?theme=${theme}`);
      await page.getByRole('button', { name: 'Show saved notification' }).click();
      await expect(page.getByText('Your changes are saved', { exact: true })).toBeVisible();
      expect(
        await page
          .getByRole('listitem')
          .filter({ hasText: 'Your changes are saved' })
          .evaluate((element) => getComputedStyle(element).fontFamily),
      ).toContain('Ubuntu Sans');
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      const action = page.getByRole('button', { name: 'Review settings', exact: true });
      await action.hover();
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      await action.focus();
      await expect(action).toBeFocused();
      expect(await action.evaluate((button) => getComputedStyle(button).boxShadow)).not.toBe(
        'none',
      );
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status', { name: 'Reviewed preferences' })).toHaveText(
        'Settings reviewed: 1',
      );
      await expect(page.getByRole('button', { name: 'Show saved notification' })).toBeFocused();
      await page.getByRole('button', { name: 'Show error notification' }).click();
      await expect(page.getByText('Unable to sync changes', { exact: true })).toBeVisible();
      const toast = page.getByRole('listitem').filter({ hasText: 'Unable to sync changes' });
      expect(await toast.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe(
        '0s',
      );
      await toast.getByRole('button', { name: 'Close toast' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByText('Unable to sync changes', { exact: true })).toBeHidden();
      await page.getByRole('button', { name: 'Show loading notification' }).click();
      const loading = page.getByRole('listitem').filter({ hasText: 'Syncing changes' });
      await expect(loading).toBeVisible();
      expect(
        await loading.locator('svg').evaluate((element) => getComputedStyle(element).animationName),
      ).toBe('none');
    },
  );
}

test(
  'toast close and action controls meet coarse-pointer targets in both themes',
  { tag: '@full' },
  async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width: 320, height: 640 },
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      for (const theme of ['light', 'dark']) {
        await page.goto(`http://127.0.0.1:4178/?theme=${theme}`);
        await page.getByRole('button', { name: 'Show saved notification' }).click();
        await expect(page.getByText('Your changes are saved', { exact: true })).toBeVisible();
        for (const name of ['Close toast', 'Review settings']) {
          const box = await page.getByRole('button', { name, exact: true }).boundingBox();
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeGreaterThanOrEqual(44);
        }
        await expectNoHorizontalOverflow(page);
      }
    } finally {
      await context.close();
    }
  },
);
