# jg-playwright

Playwright helpers for end-to-end tests: horizontal overflow, loaded assets, motion, accessibility scans, secrets, and a fake microphone.

## Install

```bash
npm install --save-dev jg-playwright @playwright/test
```

Add `@axe-core/playwright` too to scan for accessibility violations with `jg-playwright/axe`.

## Usage

Check that a page fits a small phone without scrolling sideways. The check retries until the page settles, compares against the viewport's `clientWidth`, so content under a classic scrollbar still fails, and names up to 8 elements past the right edge:

```ts
import { test } from '@playwright/test';
import { expectNoHorizontalOverflow } from 'jg-playwright';

test('the pricing page fits a small phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/pricing');
  await expectNoHorizontalOverflow(page);
});
```

Scan a page, or part of it, for WCAG 2.0 and 2.1 level A and AA violations. A failure lists each rule with its impact and how many elements break it:

```ts
import { expectNoAxeViolations } from 'jg-playwright/axe';

await expectNoAxeViolations(page);
await expectNoAxeViolations(page, { include: '[role="dialog"]' });
```

Wait until web fonts and every image have loaded, and layout has settled, before a screenshot. A broken image fails it, by its URL:

```ts
import { waitForPageAssets } from 'jg-playwright';

await waitForPageAssets(page);
await expect(page).toHaveScreenshot();
```

Check that reduced motion stops everything that moves or resizes. Fades and color changes are left out, because they're safe with reduced motion:

```ts
import { inspectMotion } from 'jg-playwright';

test.use({ reducedMotion: 'reduce' });

const { prefersReducedMotion, movingAnimations } = await inspectMotion(page);
expect(movingAnimations).toStrictEqual([]); // each entry names the element and what it animates
```

Fill a password or a one-time code without a failure printing it. Playwright's error for a failed fill carries a call log that can repeat the value, so the error keeps only its first line, with the value redacted, and has no cause:

```ts
import { fillProtectedField } from 'jg-playwright';

await fillProtectedField(page.getByLabel('Password'), password, 'The password field');
```

Record from a fake microphone. `getUserMedia` returns a steady tone, while the page's own MediaRecorder still records and encodes it:

```ts
import { installFakeMicrophone, waitForRecordedAudio } from 'jg-playwright';

await installFakeMicrophone(page); // or { rejectFirstRequest: true } to test a refused permission
await page.goto('/notes/new');
await page.getByRole('button', { name: 'Record' }).click();
await waitForRecordedAudio(page);
```

### Errors

`fillProtectedField` throws an `Exception` with the code `PROTECTED_FIELD_FILL_FAILED` when the fill fails. The other helpers fail through Playwright's `expect`, so their failures read like any other assertion's.

### Browser limits

- Headless Chromium hides scrollbars unless its `--hide-scrollbars` default argument is dropped with `launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] }`, and WebKit and Firefox may draw overlay scrollbars, which take no width.
- Playwright's WebKit on Linux has no MediaRecorder, so a page there can use the fake microphone but can't record it.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-playwright/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-playwright/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-playwright/LICENSE)
