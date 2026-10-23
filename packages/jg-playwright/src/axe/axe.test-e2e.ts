import { expect, test } from '@playwright/test';
import { expectToRejectCode } from 'jg-exception/testing';

import { ERRORS } from '../shared/index.js';
import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { expectNoAxeViolations } from './axe.js';
import type { IAxeRuleSet } from './types.js';

// two adjacent buttons smaller than WCAG 2.2's 24 by 24 pixel target size
const SMALL_TARGET_STYLE = 'width: 12px; height: 12px; padding: 0; margin: 0; border: 0';

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/': toHtmlPage(
      '<main><h1>Settings</h1><section id="good"><button type="button">Save</button></section>' +
        '<section id="bad"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />' +
        '<button type="button"></button></section>' +
        '<section id="small-targets"><button type="button" aria-label="Previous" style="' +
        SMALL_TARGET_STYLE +
        '"></button><button type="button" aria-label="Next" style="' +
        SMALL_TARGET_STYLE +
        '"></button></section>' +
        '<section id="empty-heading"><h2></h2><p>Notes</p></section></main>',
    ),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('passes when the scanned part has no violations', async ({ page }) => {
  await page.goto(server.origin);

  await expectNoAxeViolations(page, { include: '#good' });
});

test('fails with one line per violation, naming the rule, its impact, and its elements', async ({
  page,
}) => {
  await page.goto(server.origin);

  const error = await expectNoAxeViolations(page).catch((failure: unknown) => failure);

  expect(error).toBeInstanceOf(Error);
  const message = (error as Error).message;
  expect(message).toContain('axe violations');
  expect(message).toContain('image-alt (critical): 1 element, Images must have alternative text');
  expect(message).toContain(
    'button-name (critical): 1 element, Buttons must have discernible text',
  );
});

test('runs WCAG 2.2 level AA rules too with the wcag22aa rule set', async ({ page }) => {
  await page.goto(server.origin);

  await expectNoAxeViolations(page, { include: '#small-targets' });
  const error = await expectNoAxeViolations(page, {
    include: '#small-targets',
    ruleSet: 'wcag22aa',
  }).catch((failure: unknown) => failure);

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('target-size (serious): 2 elements');
});

test("runs axe's default rules, best practices included, with the axe-default rule set", async ({
  page,
}) => {
  await page.goto(server.origin);

  await expectNoAxeViolations(page, { include: '#empty-heading' });
  const error = await expectNoAxeViolations(page, {
    include: '#empty-heading',
    ruleSet: 'axe-default',
  }).catch((failure: unknown) => failure);

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain('empty-heading (minor): 1 element');
});

for (const ruleSet of ['wcag22AA', 'constructor', 'toString']) {
  test(`throws INVALID_AXE_OPTIONS for the rule set '${ruleSet}', scanning nothing`, async ({
    page,
  }) => {
    await page.goto(server.origin);

    await expectToRejectCode(
      expectNoAxeViolations(page, { include: '#bad', ruleSet: ruleSet as IAxeRuleSet }),
      ERRORS.INVALID_AXE_OPTIONS,
      "The axe rule set must be 'wcag21aa', 'wcag22aa', or 'axe-default'.",
    );
  });
}
