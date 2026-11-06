import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';

/**
 * Reads an element's box in the page, as native rectangles keep every fraction of a pixel.
 * @param page The page.
 * @param selector The element.
 * @returns The element's box.
 */
const readBox = (page: Page, selector: string) =>
  page.locator(selector).evaluate((element) => {
    const { left, top, width, height, bottom } = element.getBoundingClientRect();
    return { left, top, width, height, bottom };
  });

for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 768, 1280]) {
    test(
      `${theme} at ${width}px keeps the app patterns accessible and within the viewport`,
      { tag: '@full' },
      async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/app?theme=${theme}`);
        await expect(page.getByRole('heading', { level: 1, name: 'App patterns' })).toBeVisible();
        await waitForPageAssets(page);
        await expectNoHorizontalOverflow(page);
        expect(
          await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme),
        ).toBe(theme);
        expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);
        // the failed read's long code shrinks with the alert instead of widening the page
        await expect(
          page.getByText('Code GALLERY_PROVIDER_CATALOG', { exact: false }),
        ).toBeVisible();
      },
    );
  }
}

test('opens details as a bottom sheet on a phone, which its close button closes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app?theme=dark');
  const opener = page.getByRole('button', { name: 'Details' });
  await opener.click();
  const sheet = page.getByRole('dialog', { name: 'Session details' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('data-side', 'bottom');

  // it spans the phone at the bottom, sized to its content, and moves without animation
  await expect
    .poll(async () => (await readBox(page, '[data-slot="drawer-content"]')).bottom)
    .toBeCloseTo(640, 0);
  const box = await readBox(page, '[data-slot="drawer-content"]');
  expect(box.left).toBe(0);
  expect(box.width).toBe(320);
  expect(box.height).toBeLessThanOrEqual(640 - 48);
  expect(await sheet.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe(
    'none',
  );
  await expectNoHorizontalOverflow(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toStrictEqual([]);

  await page.getByRole('button', { name: 'Close drawer' }).click();

  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
});

test('closes the bottom sheet with a swipe down', async ({ browser, browserName }) => {
  test.skip(browserName !== 'chromium', 'only Chromium takes touch moves, through DevTools');
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4178',
    hasTouch: true,
    reducedMotion: 'reduce',
    viewport: { width: 320, height: 640 },
  });
  try {
    const page = await context.newPage();
    await page.goto('/app');
    await page.getByRole('button', { name: 'Details' }).tap();
    const sheet = page.getByRole('dialog', { name: 'Session details' });
    await expect(sheet).toBeVisible();
    await expect
      .poll(async () => (await readBox(page, '[data-slot="drawer-content"]')).bottom)
      .toBeCloseTo(640, 0);
    const header = await readBox(page, '[data-slot="drawer-header"]');
    const x = header.left + 24;
    const y = header.top + header.height / 2;
    const devTools = await context.newCDPSession(page);

    await devTools.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 15; step += 1) {
      await devTools.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + step * 20 }],
      });
    }
    await devTools.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(sheet).toBeHidden();
  } finally {
    await context.close();
  }
});

for (const theme of ['light', 'dark'] as const) {
  test(`scrolls long bottom-sheet content while its header and page stay fixed in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(`/app?theme=${theme}&details=long`);
    const opener = page.getByRole('button', { name: 'Details', exact: true });
    await opener.click();
    const sheet = page.getByRole('dialog', { name: 'Session details', exact: true });
    await expect(sheet).toBeVisible();
    const last = sheet.getByRole('button', { name: 'Session 64', exact: true });
    await expect(last).not.toBeInViewport();
    const heading = sheet.getByRole('heading', { name: 'Session details', exact: true });
    const before = await heading.evaluate((element) => ({
      top: element.getBoundingClientRect().top,
      pageTop: scrollY,
    }));
    const box = (await sheet.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Firefox bounds each wheel gesture to a page even when its delta exceeds the list.
    await expect(async () => {
      await page.mouse.wheel(0, 10000);
      await expect(last).toBeInViewport({ timeout: 500 });
    }).toPass({ timeout: 5000, intervals: [100] });
    expect(
      await heading.evaluate((element) => ({
        top: element.getBoundingClientRect().top,
        pageTop: scrollY,
      })),
    ).toStrictEqual(before);
    await sheet.getByRole('button', { name: 'Close drawer' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(last).toBeFocused();
    await expect(last).toBeInViewport();
    await expectNoHorizontalOverflow(page);
    expect(
      (await new AxeBuilder({ page }).include('[data-slot="drawer-content"]').analyze()).violations,
    ).toStrictEqual([]);
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(opener).toBeFocused();
  });
}

test('opens details as a dialog from the md breakpoint, which Escape closes', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app?theme=light');
  const opener = page.getByRole('button', { name: 'Details' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Session details' });
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-slot="dialog-content"]')).toBeVisible();
  await expect(page.locator('[data-slot="drawer-content"]')).toHaveCount(0);

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('shows all of a clamped text from the keyboard, and Back leads to the gallery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/app?theme=light');
  const toggle = page.getByRole('button', { name: 'Show all' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const clampedHeight = (await readBox(page, '[data-slot="clamped-text"] p')).height;

  await toggle.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('button', { name: 'Show less' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  expect((await readBox(page, '[data-slot="clamped-text"] p')).height).toBeGreaterThan(
    clampedHeight,
  );
  // the document's headings nest under the page's own
  await expect(page.getByRole('heading', { level: 2, name: 'Plan' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Steps' })).toBeVisible();

  await page.getByRole('link', { name: 'Back to Gallery' }).click();
  await expect(page).toHaveURL(/\/$/u);
});

test('switches views with link buttons that replace the history entry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.goto('/app?view=overview');
  const views = page.getByRole('navigation', { name: 'Session views' });
  await expect(views.getByRole('link', { name: 'Overview' })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await views.getByRole('link', { name: 'Model settings' }).click();

  await expect(page).toHaveURL(/view=settings/u);
  await expect(views.getByRole('link', { name: 'Model settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // the row scrolled the selected view into sight, without scrolling the page sideways
  const link = await readBox(page, '[aria-current="page"]');
  expect(link.left + link.width).toBeLessThanOrEqual(320);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/u);
});

test('shows avatars and their fallbacks at one size', { tag: '@full' }, async ({ page }) => {
  await page.goto('/app?theme=dark');
  const avatars = page.locator('[aria-labelledby="people-title"] [data-slot="avatar"]');
  await expect(avatars).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Ada Lovelace' })).toHaveAttribute(
    'data-initial',
    'A',
  );
  for (const index of [0, 1, 2]) {
    const box = await avatars.nth(index).evaluate((element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    });
    expect(box).toStrictEqual({ width: 44, height: 44 });
  }
});

test('loads the next events as the reader scrolls to the end, until the last page', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 600 });
  await page.goto('/app');
  const events = page.getByRole('list', { name: 'Events' }).getByRole('listitem');
  await expect(events).toHaveCount(8);

  await page.getByRole('button', { name: 'Load more' }).scrollIntoViewIfNeeded();

  await expect(events).toHaveCount(24);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});

test(
  'keeps touch targets at least 44px under a coarse pointer',
  { tag: '@full' },
  async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: 'http://127.0.0.1:4178',
      hasTouch: true,
      viewport: { width: 320, height: 800 },
    });
    try {
      const page = await context.newPage();
      await page.goto('/app');
      for (const target of [
        page.getByRole('button', { name: 'Show all' }),
        page.getByRole('link', { name: 'Back to Gallery' }),
        page
          .getByRole('navigation', { name: 'Session views' })
          .getByRole('link', { name: 'History' }),
      ]) {
        const box = await target.evaluate((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { width, height };
        });
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    } finally {
      await context.close();
    }
  },
);

test('offers a reload for a page whose code a newer build replaced', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/app/replaced?theme=light');

  await expect(page.getByText('The app was updated')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await expect(page).toHaveTitle('The app was updated · JG UI gallery');
  await expectNoHorizontalOverflow(page);
});
