import { expect, type Page } from '@playwright/test';

import type { IAxeOptions } from './types.js';

// the WCAG 2.0 and 2.1 levels A and AA rules every scan runs
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Scans the page with axe-core for WCAG 2.0 and 2.1 level A and AA violations, and fails with one
 * line per violation, naming the rule, its impact, how many elements break it, and its help text.
 * Install `@axe-core/playwright`, an optional peer this function loads when it's first called, so
 * the rest of the package works without it.
 * @param page The page.
 * @param options What to scan: the whole page, or the part a selector matches.
 * @returns A promise that resolves when the scan finds nothing, or rejects with Playwright's
 * assertion error listing the violations.
 * @example
 * import { test } from '@playwright/test';
 * import { expectNoAxeViolations } from 'jg-playwright/axe';
 *
 * test('the open menu is accessible', async ({ page }) => {
 *   await page.goto('/');
 *   await page.getByRole('button', { name: 'Menu' }).click();
 *   await expectNoAxeViolations(page, { include: '[role="dialog"]' });
 * });
 */
export const expectNoAxeViolations = async (
  page: Page,
  { include }: IAxeOptions = {},
): Promise<void> => {
  const { AxeBuilder } = await import('@axe-core/playwright');
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  const { violations } = await (
    include === undefined ? builder : builder.include(include)
  ).analyze();
  expect(
    violations.map(
      ({ help, id, impact, nodes }) =>
        `${id} (${impact ?? 'unknown impact'}): ${nodes.length} element${nodes.length === 1 ? '' : 's'}, ${help}`,
    ),
    'axe violations',
  ).toStrictEqual([]);
};
