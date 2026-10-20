import { expect, test } from '@playwright/test';

import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { expectNoAxeViolations } from './axe.js';

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/': toHtmlPage(
      '<main><h1>Settings</h1><section id="good"><button type="button">Save</button></section>' +
        '<section id="bad"><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />' +
        '<button type="button"></button></section></main>',
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
