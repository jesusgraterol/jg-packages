import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test(
  'native keyboard activation preserves rich summary names and exclusive groups',
  { tag: '@full' },
  async ({ page }) => {
    await page.goto('/interactions/');
    const experience = page.locator('summary').filter({ hasText: 'Project experience' });
    await expect(experience).toHaveAccessibleName(
      /Project experience Engineering and product development, 2020–present Active/u,
    );
    await experience.focus();
    await expect(experience).toBeFocused();
    await experience.press('Enter');
    await expect(
      page.getByText('Portfolio logos, dates, and status remain part of the summary.'),
    ).toBeVisible();
    await experience.press(' ');
    await expect(
      page.getByText('Portfolio logos, dates, and status remain part of the summary.'),
    ).toBeHidden();
    await expect(page.getByText('This body uses the named body slot.')).toBeVisible();
    await page.locator('summary').filter({ hasText: 'First grouped disclosure' }).click();
    await expect(page.getByText('First exclusive body.')).toBeVisible();
    await page.locator('summary').filter({ hasText: 'Second grouped disclosure' }).click();
    await expect(page.getByText('First exclusive body.')).toBeHidden();
    await expect(page.getByText('Second exclusive body.')).toBeVisible();
    await expect(page.getByText('This body uses the named body slot.')).toBeVisible();
  },
);

test('initial and later encoded hash navigation reveals all collapsed ancestors', async ({
  page,
}) => {
  await page.goto('/interactions/#project%3Adetails');
  const target = page.getByText('Deep-linked project details.', { exact: true });
  await expect(target).toBeVisible();
  await expect(target).toBeInViewport();
  await page.locator('summary').filter({ hasText: 'Project experience' }).click();
  await expect(target).toBeHidden();
  await page.evaluate(() => {
    location.hash = 'accordion-title';
  });
  await page.getByRole('link', { name: 'Open deep-linked project details', exact: true }).click();
  await expect(target).toBeVisible();
  const link = page.getByRole('link', { name: 'Open deep-linked project details', exact: true });
  await link.focus();
  await page.evaluate(() => {
    history.replaceState(null, '', '#project%3Adetails');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  await expect(link).toBeFocused();
  await page.evaluate(() => {
    location.hash = '%E0%A4%A';
  });
  await expect(target).toBeVisible();
});

test('Astro page replacement reveals the new deep link with the existing controller', async ({
  page,
}) => {
  await page.goto('/interactions/');
  await page.evaluate(() => {
    Reflect.set(document, Symbol.for('gallery.accordion-navigation'), true);
  });
  await page.getByRole('link', { name: 'Open this example as a page', exact: true }).click();
  await expect(page).toHaveURL(/\?example=deep-link#project%3Adetails$/u);
  await expect(page.getByText('Deep-linked project details.', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => Reflect.get(document, Symbol.for('gallery.accordion-navigation')) === true,
    ),
  ).toBe(true);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(
    `rich and nested disclosures fit 320px and desktop in ${colorScheme}`,
    { tag: '@full' },
    async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      await page.goto('/interactions/');
      for (const width of [320, 1280]) {
        await page.setViewportSize({ width, height: 800 });
        const outer = page.locator('summary').filter({ hasText: 'Project experience' });
        const nested = page.locator('summary').filter({ hasText: 'Nested project details' });
        await outer.click();
        const summaryText = await outer
          .getByText('Engineering and product development, 2020–present', { exact: true })
          .boundingBox();
        const status = await outer.getByText('Active', { exact: true }).boundingBox();
        if (summaryText === null || status === null)
          throw new Error('Rich summary content is not visible.');
        if (width === 320)
          expect(status.y).toBeGreaterThanOrEqual(summaryText.y + summaryText.height);
        else expect(status.y).toBeLessThan(summaryText.y + summaryText.height);
        await nested.click();
        await expectNoHorizontalOverflow(page);
        await nested.click();
        await expect
          .poll(() =>
            page
              .locator('#nested-experience > summary > .jg-accordion-chevron')
              .evaluate((icon) => getComputedStyle(icon).transform),
          )
          .toBe('none');
        const transforms = await page
          .locator('#experience .jg-accordion-chevron')
          .evaluateAll((icons) =>
            icons.map((icon) => ({
              transform: getComputedStyle(icon).transform,
              duration: parseFloat(getComputedStyle(icon).transitionDuration),
            })),
          );
        expect(transforms[0]?.transform).toBe('matrix(-1, 0, 0, -1, 0, 0)');
        expect(transforms[1]?.transform).toBe('none');
        expect(transforms.every((icon) => icon.duration <= 0.00001)).toBe(true);
        await outer.focus();
        await outer.press('Tab');
        await page.keyboard.press('Shift+Tab');
        await expect(outer).toBeFocused();
        expect(await outer.evaluate((summary) => getComputedStyle(summary).outlineStyle)).not.toBe(
          'none',
        );
        await outer.click();
      }
      const audit = await new AxeBuilder({ page }).include('[data-example="accordion"]').analyze();
      expect(audit.violations).toStrictEqual([]);
    },
  );
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test(
    'native summaries retain disclosure and grouping behavior',
    { tag: '@full' },
    async ({ page }) => {
      await page.goto('/interactions/');
      await page.locator('summary').filter({ hasText: 'Project experience' }).click();
      await page.locator('summary').filter({ hasText: 'Nested project details' }).click();
      await expect(page.getByText('Deep-linked project details.', { exact: true })).toBeVisible();
      await page.locator('summary').filter({ hasText: 'First grouped disclosure' }).click();
      await page.locator('summary').filter({ hasText: 'Second grouped disclosure' }).click();
      await expect(page.getByText('First exclusive body.')).toBeHidden();
      await expect(page.getByText('Second exclusive body.')).toBeVisible();
    },
  );
});
