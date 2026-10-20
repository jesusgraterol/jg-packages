import type { Locator } from '@playwright/test';
import { Exception, extractMessage } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

/**
 * Fills a field that holds a secret, such as a password or a one-time code, without letting a
 * failure print it. Playwright's error for a failed fill carries a call log that can repeat the
 * value, so the error thrown instead keeps only the first line of Playwright's message, with any
 * copy of the value replaced by `[redacted]`, and deliberately has no `cause`.
 * @param field The field, such as `page.getByLabel('Password')`.
 * @param value The secret.
 * @param fieldDescription What the field is, for the error, such as 'The password field'.
 * @param options Playwright's fill options, such as `{ timeout: 10_000 }`.
 * @returns A promise that resolves once the field is filled.
 * @throws
 * - PROTECTED_FIELD_FILL_FAILED: `${fieldDescription}: ${the first line of Playwright's message}`
 * @example
 * import { test } from '@playwright/test';
 * import { fillProtectedField } from 'jg-playwright';
 *
 * test('signs in', async ({ page }) => {
 *   await page.goto('/sign-in');
 *   await fillProtectedField(
 *     page.getByLabel('Password'),
 *     process.env['E2E_PASSWORD'] ?? '',
 *     'The password field',
 *   );
 * });
 */
export const fillProtectedField = async (
  field: Pick<Locator, 'fill'>,
  value: string,
  fieldDescription: string,
  options?: Parameters<Locator['fill']>[1],
): Promise<void> => {
  try {
    await field.fill(value, options);
  } catch (error) {
    // no cause: Playwright's error holds the call log this function keeps out of reports
    throw new Exception(`${fieldDescription}: ${extractMessage(error).split(/\r?\n/u)[0]}`, {
      code: ERRORS.PROTECTED_FIELD_FILL_FAILED,
      redact: [value],
    });
  }
};
