import { expect, type Page } from '@playwright/test';
import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';
import type { IAxeOptions, IAxeRuleSet } from './types.js';

// the tags of the rules each rule set runs; axe's default rules run without tags
const RULE_SET_TAGS: Record<IAxeRuleSet, string[] | undefined> = {
  wcag21aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  wcag22aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
  'axe-default': undefined,
};

/**
 * Scans the page with axe-core for violations, and fails with one line per violation, naming the
 * rule, its impact, how many elements break it, and its help text. It runs the WCAG 2.0 and 2.1
 * level A and AA rules unless `ruleSet` asks for WCAG 2.2 level AA too, `'wcag22aa'`, or for every
 * rule axe runs by default, best practices included, `'axe-default'`. Install
 * `@axe-core/playwright`, an optional peer this function loads when it's first called, so the rest
 * of the package works without it. Any other `ruleSet`, such as `'wcag22AA'`, throws before
 * anything is scanned.
 * @param page The page.
 * @param options What to scan, the whole page or the part a selector matches, and which rules.
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
 *
 * test('the home page meets WCAG 2.2 level AA', async ({ page }) => {
 *   await page.goto('/');
 *   await expectNoAxeViolations(page, { ruleSet: 'wcag22aa' });
 * });
 * @throws
 * - INVALID_AXE_OPTIONS: The axe rule set must be 'wcag21aa', 'wcag22aa', or 'axe-default'.
 */
export const expectNoAxeViolations = async (
  page: Page,
  { include, ruleSet = 'wcag21aa' }: IAxeOptions = {},
): Promise<void> => {
  // an unchecked lookup would run axe's default rules for a typo, or an Object method's "tags"
  if (!Object.hasOwn(RULE_SET_TAGS, ruleSet)) {
    throw new Exception("The axe rule set must be 'wcag21aa', 'wcag22aa', or 'axe-default'.", {
      code: ERRORS.INVALID_AXE_OPTIONS,
      data: { ruleSet: String(ruleSet) },
    });
  }
  const { AxeBuilder } = await import('@axe-core/playwright');
  const builder = new AxeBuilder({ page });
  const tags = RULE_SET_TAGS[ruleSet];
  if (tags !== undefined) {
    builder.withTags(tags);
  }
  if (include !== undefined) {
    builder.include(include);
  }
  const { violations } = await builder.analyze();
  expect(
    violations.map(
      ({ help, id, impact, nodes }) =>
        `${id} (${impact ?? 'unknown impact'}): ${nodes.length} element${nodes.length === 1 ? '' : 's'}, ${help}`,
    ),
    'axe violations',
  ).toStrictEqual([]);
};
