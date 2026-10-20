# jg-playwright recipes

Patterns for end-to-end suites that check layout, accessibility, and motion on every page, and sign in without printing secrets.

## Layout and accessibility checks at every width and theme

Use this to check a set of pages at the widths and color schemes the site supports. Each page gets its own test per width and theme, so a failure names exactly where it happened, and the axe scan runs once per theme at a desktop width, where every part of the page is shown:

```ts
import { test } from '@playwright/test';
import { expectNoHorizontalOverflow, waitForPageAssets } from 'jg-playwright';
import { expectNoAxeViolations } from 'jg-playwright/axe';

// the pages the suite checks
const PATHS = ['/', '/pricing', '/docs/install'];

// the narrowest phone, a tablet, and a desktop
const WIDTHS = [320, 768, 1280];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`in the ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const path of PATHS) {
      for (const width of WIDTHS) {
        test(`${path} fits ${width} px`, async ({ page }) => {
          await page.setViewportSize({ width, height: 800 });
          await page.goto(path);
          await waitForPageAssets(page);
          await expectNoHorizontalOverflow(page);
        });
      }

      test(`${path} has no axe violations`, async ({ page }) => {
        await page.goto(path);
        await expectNoAxeViolations(page);
      });
    }
  });
}
```

`waitForPageAssets` comes first, because a font or an image that loads late can change the layout the overflow check measures.

## Signing in once, without printing the password

Use this in a setup project that signs in before the other tests and saves the session. The password comes from the environment, and a failed fill reports which field failed without the value, so it stays out of CI logs and reports:

```ts
import { expect, test as setup } from '@playwright/test';
import { fillProtectedField } from 'jg-playwright';

// where the other projects read the signed-in session from, through storageState
const SESSION_FILE = 'playwright/.auth/session.json';

setup('signs in', async ({ page }) => {
  const email = process.env['E2E_EMAIL'];
  const password = process.env['E2E_PASSWORD'];
  if (email === undefined || password === undefined) {
    throw new Error('Set E2E_EMAIL and E2E_PASSWORD to run the signed-in tests.');
  }

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(email);
  await fillProtectedField(page.getByLabel('Password'), password, 'The password field');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.context().storageState({ path: SESSION_FILE });
});
```

Playwright's trace records the values typed into fields, so keep traces off for this project, or out of shared artifacts.

## Reduced motion that stops everything moving

Use this to check that a page honors `prefers-reduced-motion`. The test opens the parts that animate, then lists what still moves or resizes:

```ts
import { expect, test } from '@playwright/test';
import { inspectMotion } from 'jg-playwright';

test.use({ reducedMotion: 'reduce' });

test('the menu opens without moving', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();

  const { prefersReducedMotion, movingAnimations } = await inspectMotion(page);

  expect(prefersReducedMotion).toBe(true);
  // a spinner that keeps spinning is often fine; leave out what the design allows
  expect(movingAnimations.filter(({ slot }) => slot !== 'spinner')).toStrictEqual([]);
});
```

Each entry names the element's tag, its `data-slot`, the properties it animates, and its timing, so a failure shows what to fix. Fades and color changes are never listed.
