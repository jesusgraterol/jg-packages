import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('all panels remain readable and panel links work', async ({ page }) => {
    await page.goto('/interactions/');
    await expect(page.getByText('TypeScript example panel.', { exact: true })).toBeVisible();
    await expect(page.getByText('JavaScript example panel.', { exact: true })).toBeVisible();
    await expect(page.getByText('Nested overview.', { exact: true })).toBeVisible();
    await expect(page.getByText('Nested details.', { exact: true })).toBeVisible();
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await page.getByRole('link', { name: 'JavaScript with a longer label', exact: true }).click();
    await expect(page).toHaveURL(/#example-tabs-panel-javascript$/u);
    await expect(page.getByText('npm install jg-site', { exact: true })).toBeVisible();
    await expect(page.getByText('pnpm add jg-site', { exact: true })).toBeVisible();
  });
});

test('storage failures keep installation tabs synchronized and operable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('Storage is blocked', 'SecurityError');
      },
    });
  });
  await page.goto('/interactions/');
  const lists = page.getByRole('tablist', { name: 'Package manager', exact: true });
  await expect(lists).toHaveCount(2);
  await expect(lists.first().getByRole('tab', { name: 'npm', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await lists.first().getByRole('tab', { name: 'pnpm', exact: true }).click();
  await expect(lists.last().getByRole('tab', { name: 'pnpm', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByText('pnpm add jg-site', { exact: true })).toBeVisible();
});

test('unknown stored choices fall back and keyboard activation persists a valid choice', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('gallery-package-manager', 'unknown'));
  await page.goto('/interactions/');
  const lists = page.getByRole('tablist', { name: 'Package manager', exact: true });
  const npm = lists.first().getByRole('tab', { name: 'npm', exact: true });
  const pnpm = lists.first().getByRole('tab', { name: 'pnpm', exact: true });
  await expect(npm).toHaveAttribute('aria-selected', 'true');
  await npm.focus();
  await npm.press('End');
  await expect(pnpm).toBeFocused();
  await pnpm.press(' ');
  await expect(lists.last().getByRole('tab', { name: 'pnpm', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(await page.evaluate(() => localStorage.getItem('gallery-package-manager'))).toBe('pnpm');
  await pnpm.press('Home');
  await npm.press('Enter');
  await expect(npm).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('gallery-package-manager'))).toBe('npm');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`long tab labels scroll horizontally without clipping or document movement in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/interactions/');
    const list = page.getByRole('tablist', { name: 'Scrollable reference', exact: true });
    const first = list.getByRole('tab', { name: 'Overview of the package', exact: true });
    const last = list.getByRole('tab', { name: 'Troubleshooting and recovery', exact: true });
    await first.focus();
    const scrollY = await page.evaluate(() => window.scrollY);
    await first.press('End');
    await expect(last).toBeFocused();
    await expect(last).toHaveAttribute('aria-selected', 'true');
    const geometry = await last.evaluate((tab) => {
      const strip = tab.closest('[data-tabs]')?.querySelector<HTMLElement>('[data-tab-strip]');
      if (strip === null || strip === undefined) throw new Error('The tab strip is missing.');
      const bounds = strip.getBoundingClientRect();
      const selected = tab.getBoundingClientRect();
      return {
        scrollHeight: strip.scrollHeight,
        clientHeight: strip.clientHeight,
        scrollWidth: strip.scrollWidth,
        clientWidth: strip.clientWidth,
        left: selected.left - bounds.left - strip.clientLeft,
        right: selected.right - bounds.left - strip.clientLeft,
      };
    });
    expect(geometry.scrollHeight).toBe(geometry.clientHeight);
    expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth);
    expect(geometry.left).toBeGreaterThanOrEqual(-1);
    expect(geometry.right).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
    expect(await page.evaluate(() => localStorage.getItem('gallery-reference["choice"]'))).toBe(
      'recovery',
    );
    await expectNoHorizontalOverflow(page);
    await expect(
      page.getByRole('button', { name: 'Copy tab actions example', exact: true }),
    ).toHaveCount(1);
  });
}
