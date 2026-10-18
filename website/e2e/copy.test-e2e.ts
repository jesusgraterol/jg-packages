import { expect, test, type Locator, type Page } from '@playwright/test';

import { SITE_CONFIG } from '../src/site.config.ts';
import { listTypeScriptBlocks } from './site.test-utils.ts';

/*
 * Copying: code windows in READMEs and recipes, the agent setup's install command, "Copy page as
 * Markdown", and the guidance when copying fails.
 */

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

/**
 * Empties the clipboard, clicks a copy button, and waits for its outcome.
 * @param page The page.
 * @param button The copy button.
 * @returns A promise that resolves to what the clipboard holds afterwards.
 */
const copyWith = async (page: Page, button: Locator): Promise<string> => {
  await page.evaluate(() => navigator.clipboard.writeText(''));
  await button.click();
  await expect(button).toHaveAttribute('data-copy-state', /^(?:success|error)$/u);
  return page.evaluate(() => navigator.clipboard.readText());
};

test("a README's code windows copy exactly the code they show", async ({ page }) => {
  await page.goto('/packages/jg-fetch/');
  // the API reference's declarations are code windows without a copy button
  const windows = page.locator('main .jg-code-window:has([data-copy-button])');
  const count = await windows.count();
  expect(count).toBeGreaterThan(1);

  for (const index of [0, count - 1]) {
    const codeWindow = windows.nth(index);
    const shown = (await codeWindow.locator('pre').textContent()) ?? '';
    expect(shown).not.toBe('');
    expect(await copyWith(page, codeWindow.locator('[data-copy-button]'))).toBe(shown);
  }
});

for (const name of ['jg-fetch', 'jg-exception']) {
  test(`${name}'s recipes copy exactly the blocks of its RECIPES.md`, async ({ page, request }) => {
    const blocks = listTypeScriptBlocks(
      await (await request.get(`/packages/${name}/recipes/index.md`)).text(),
    );
    await page.goto(`/packages/${name}/recipes/`);
    const windows = page.locator('main .jg-code-window');
    await expect(windows).toHaveCount(blocks.length);

    for (const index of [0, blocks.length - 1]) {
      expect(await copyWith(page, windows.nth(index).locator('[data-copy-button]'))).toBe(
        blocks[index],
      );
    }
  });
}

for (const path of ['/packages/jg-fetch/', '/packages/jg-fetch/recipes/']) {
  test(`"Copy page as Markdown" on ${path} copies exactly its Markdown version`, async ({
    page,
    request,
  }) => {
    const markdown = await (await request.get(`${path}index.md`)).text();
    await page.goto(path);
    // found by its URL, since its name changes with each outcome
    const button = page.locator('[data-copy-button][data-copy-url]');
    await expect(button).toHaveAccessibleName('Copy page as Markdown');

    expect(await copyWith(page, button)).toBe(markdown);
    await expect(button).toHaveAccessibleName('Copied as Markdown');
    await expect(button).toHaveAccessibleName('Copy page as Markdown', { timeout: 3_000 });
  });
}

test.describe('at 320 px', () => {
  test.use({ viewport: { width: 320, height: 800 } });

  test('"Copy page as Markdown" links to the Markdown when it fails to load', async ({ page }) => {
    await page.route('**/packages/jg-fetch/index.md', (route) =>
      route.fulfill({ status: 500, body: 'Server error' }),
    );
    await page.goto('/packages/jg-fetch/');

    await copyWith(page, page.locator('[data-copy-button][data-copy-url]'));

    const hint = page.locator('[data-copy-hint]:visible');
    await expect(hint).toContainText(
      'Copying failed. Open the link below and copy the text there.',
    );
    const link = hint.getByRole('link', { name: '/packages/jg-fetch/index.md' });
    await expect(link).toHaveAttribute('href', '/packages/jg-fetch/index.md');
    // the guidance fits on a phone's screen
    const box = await hint.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320);
  });
});

test.describe('without the clipboard', () => {
  test('a code window says how to copy its code by hand', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: undefined });
    });
    await page.goto('/packages/jg-fetch/');
    const codeWindow = page.locator('main .jg-code-window').first();
    const button = codeWindow.locator('[data-copy-button]');

    await button.click();

    await expect(button).toHaveAttribute('data-copy-state', 'error');
    await expect(codeWindow.locator('[data-copy-hint]')).toHaveText(
      "This browser can't copy from this page. Select the code and copy it manually.",
    );
  });

  test('a failed write says to copy by hand', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error('Disk full.'));
    });
    await page.goto('/packages/jg-fetch/');
    const codeWindow = page.locator('main .jg-code-window').first();

    await codeWindow.locator('[data-copy-button]').click();

    await expect(codeWindow.locator('[data-copy-hint]')).toHaveText(
      'Copying failed. Select the code and copy it manually.',
    );
  });
});

test.describe('the agent setup', () => {
  test('links to the policy and the skill page in new tabs, without loading them', async ({
    context,
    page,
  }) => {
    const external: string[] = [];
    await context.route(/jg-skills/u, (route) => {
      external.push(route.request().url());
      return route.abort();
    });
    await page.goto('/');
    const { policyUrl, skillUrl } = SITE_CONFIG.agentSetup;

    for (const [name, url] of [
      ['Open the policy', policyUrl],
      ['About the skill', skillUrl],
    ] as const) {
      const link = page.getByRole('link', { name: `${name} (opens in a new tab)` });
      await expect(link).toHaveAttribute('href', url);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noreferrer');
    }
    expect(external).toStrictEqual([]);
  });

  test('copies exactly the install command', async ({ page }) => {
    await page.goto('/');
    const button = page.locator('#setup [data-copy-button]');

    expect(await copyWith(page, button)).toBe(SITE_CONFIG.agentSetup.installCommand);
  });
});
