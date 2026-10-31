import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} phone query recovery hides revoked records until a successful retry`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 640 },
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      let status = 200;
      let content = 'Private original record';
      let release!: () => void;
      const pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      let hold = true;
      await page.route('**/records.txt?*', async (route) => {
        if (hold) await pending;
        await route.fulfill({ status, contentType: 'text/plain', body: content });
      });
      await page.goto(`http://127.0.0.1:4178/queries?theme=${theme}`);
      await expect(page.getByRole('status', { name: 'Loading data' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Current records' })).toHaveCount(0);
      hold = false;
      release();
      const records = page.getByRole('region', { name: 'Current records' });
      await expect(records).toContainText('Private original record');
      const more = page.getByRole('button', { name: 'Load more', exact: true });
      expect((await more.boundingBox())?.height).toBeGreaterThanOrEqual(44);
      await more.click();
      await expect(records.getByRole('article')).toHaveCount(2);
      status = 503;
      content = 'PRIVATE SERVICE DIAGNOSTICS';
      await page.getByRole('button', { name: 'Refresh records' }).click();
      const toast = page.locator('[data-sonner-toast]');
      await expect(toast).toContainText('Could not update');
      await expect(records).toContainText('Private original record');
      await expect(toast).not.toContainText('PRIVATE SERVICE');
      status = 403;
      await toast.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Access to these records was revoked.');
      await expect(records).toHaveCount(0);
      status = 503;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText(
        'The records could not be loaded. Try again.',
      );
      await expect(records).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      status = 200;
      content = 'Private updated record';
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(records).toContainText('Private updated record');
      await expect(page.getByRole('alert')).toHaveCount(0);
      await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
      await expect(page.getByText('PRIVATE SERVICE DIAGNOSTICS', { exact: true })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });

  test(`${theme} global recovery is private, keyboard accessible, and readable at narrow and wide sizes`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/route-error?theme=${theme}`);
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Error code: Unknown');
    await expect(page.getByRole('main')).not.toContainText('PRIVATE ROUTE DIAGNOSTICS');
    const refresh = page.getByRole('button', { name: 'Refresh app' });
    await refresh.focus();
    await expect(refresh).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(refresh).toBeFocused();
    expect(await refresh.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe(
      'none',
    );
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 640 });
      await expectNoHorizontalOverflow(page);
      expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
      expect(
        await page.getByRole('main').evaluate((element) => getComputedStyle(element).colorScheme),
      ).toBe('dark');
    }
  });
}

test('pending routes retain dialogs and committed navigation releases focus and scroll for in-app Back', async ({
  page,
  browserName,
}) => {
  const safeTop = browserName === 'chromium' ? 32 : 0;
  const safeSession =
    browserName === 'chromium' ? await page.context().newCDPSession(page) : undefined;
  await safeSession?.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 32, bottom: 24, left: 12, right: 12 },
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/records.txt?*', async (route) => {
    await route.fulfill({
      contentType: 'text/plain',
      body: 'Current record content. '.repeat(128),
    });
  });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/route-ready.txt', async (route) => {
    await pending;
    await route.fulfill({ body: 'ready' });
  });
  try {
    await page.goto('/queries?theme=dark');
    await expect(page.getByRole('region', { name: 'Current records' })).toBeVisible();
    expect
      .soft((await page.getByRole('heading', { name: 'Query recovery' }).boundingBox())?.y)
      .toBeGreaterThanOrEqual(safeTop);
    await page.evaluate(() => window.scrollTo(0, 256));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(256);
    // opening a sheet scrolls its trigger into view; record the position the user actually left.
    await page.getByRole('button', { name: 'Open query dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Query draft' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('link', { name: 'Continue to next screen' }).click();
    // the modal intentionally removes background progress from the accessibility tree.
    const progress = page.locator('[role="progressbar"][aria-label="Loading route"]');
    await expect(progress).toBeVisible();
    expect.soft((await progress.boundingBox())?.y).toBeGreaterThanOrEqual(safeTop);
    await expect(dialog).toBeVisible();
    release();
    await expect(page.getByRole('heading', { name: 'Next query screen' })).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.className))
      .toContain('jg-page-outlet');
    expect(await page.evaluate(() => document.body.style.position)).not.toBe('fixed');
    await page.getByRole('button', { name: 'Back to query recovery' }).click();
    await expect(page.getByRole('heading', { name: 'Query recovery' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Current records' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  } finally {
    release();
    await safeSession?.detach();
  }
});

test('in-app Back restores a nonzero scroll position after query content remounts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/records.txt?*', async (route) => {
    await route.fulfill({
      contentType: 'text/plain',
      body: 'Current record content. '.repeat(128),
    });
  });
  await page.goto('/queries?theme=light');
  const next = page.getByRole('link', { name: 'Continue after records' });
  await next.scrollIntoViewIfNeeded();
  const previousScroll = await page.evaluate(() => window.scrollY);
  expect(previousScroll).toBeGreaterThan(0);
  await next.click();
  await expect(page.getByRole('heading', { name: 'Next query screen' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole('button', { name: 'Back to query recovery' }).click();
  await expect(page.getByRole('heading', { name: 'Query recovery' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(previousScroll);
});
