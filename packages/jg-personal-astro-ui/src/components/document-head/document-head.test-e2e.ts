import { expect, test } from '@playwright/test';

/*
 * Chromium settles an incoming page's view-transition opt-in when its body starts, so a stylesheet
 * that arrives later must not skip the crossfade or leave the transition's rejected promise
 * unhandled. Under reduced motion, pages never transition, however late the stylesheet arrives.
 */
for (const { title, reducedMotion, hasTransition } of [
  {
    title: 'a slow stylesheet keeps the native page transition',
    reducedMotion: 'no-preference',
    hasTransition: true,
  },
  {
    title: 'reduced motion keeps pages from transitioning, however slow the stylesheet',
    reducedMotion: 'reduce',
    hasTransition: false,
  },
] as const) {
  test(title, async ({ browserName, context, page }) => {
    test.skip(
      browserName === 'firefox',
      "Firefox doesn't support cross-document view transitions.",
    );
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.emulateMedia({ reducedMotion });
    await page.goto('/');
    await page.addInitScript(() => {
      window.addEventListener('pagereveal', (event) => {
        document.documentElement.dataset['revealedTransition'] = String(
          event.viewTransition !== null,
        );
      });
    });
    // simulates a slow network or device: the destination's stylesheet arrives after its body starts
    await context.route('**/_astro/*.css', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.continue();
    });
    await page
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('link', { name: 'Foundations', exact: true })
      .click();
    await expect(page).toHaveURL('/foundations/');
    await expect(page.locator('html')).toHaveAttribute(
      'data-revealed-transition',
      String(hasTransition),
    );
    await page.evaluate(async () => {
      await document.activeViewTransition?.finished;
    });
    expect(errors).toStrictEqual([]);
  });
}
