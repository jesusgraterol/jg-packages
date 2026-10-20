import { expect, test } from '@playwright/test';
import { isException } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';

import { ERRORS } from '../shared/index.js';
import {
  startStaticServer,
  toHtmlPage,
  type IStaticServer,
} from '../shared/static-server.test-utils.js';
import { fillProtectedField } from './protected-field.js';

// a value no message may contain
const SECRET = 'correct horse battery staple';

let server: IStaticServer;

test.beforeAll(async () => {
  server = await startStaticServer({
    '/': toHtmlPage(
      '<label>Password <input type="password" name="password" /></label>' +
        '<label>Code <input name="code" disabled /></label>',
    ),
  });
});

test.afterAll(async () => {
  await server.close();
});

test('fills the field', async ({ page }) => {
  await page.goto(server.origin);

  await fillProtectedField(page.getByLabel('Password'), SECRET, 'The password field');

  await expect(page.getByLabel('Password')).toHaveValue(SECRET);
});

test("fails with the field's description and Playwright's first line, without a cause", async ({
  page,
}) => {
  await page.goto(server.origin);

  const failure = fillProtectedField(page.getByLabel('Code'), SECRET, 'The code field', {
    timeout: 500,
  });

  await expectToRejectCode(
    failure,
    ERRORS.PROTECTED_FIELD_FILL_FAILED,
    'The code field: locator.fill: Timeout 500ms exceeded.',
  );
  const error = await failure.catch((rejection: unknown) => rejection);
  expect(isException(error)).toBe(true);
  expect((error as Error).message.split('\n')).toHaveLength(1);
  expect((error as Error).message).not.toContain(SECRET);
  expect((error as Error).cause).toBeUndefined();
});

test('keeps the value out of the message, even when the first line repeats it', async () => {
  const field = {
    fill: () =>
      Promise.reject(new Error(`fill("${SECRET}") failed\nCall log:\n  - fill("${SECRET}")`)),
  };

  const error = await fillProtectedField(field, SECRET, 'The password field').catch(
    (rejection: unknown) => rejection,
  );

  expect(error).toMatchObject({
    code: ERRORS.PROTECTED_FIELD_FILL_FAILED,
    message: 'The password field: fill("[redacted]") failed',
  });
  expect((error as Error).cause).toBeUndefined();
});
