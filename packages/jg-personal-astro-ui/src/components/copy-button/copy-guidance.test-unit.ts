import { ERRORS } from 'jg-clipboard';
import { describe, expect, test } from 'vitest';

import { getCopyGuidance } from './copy-guidance.ts';

describe('getCopyGuidance', () => {
  test.each([
    [
      ERRORS.CLIPBOARD_PERMISSION_DENIED,
      'Your browser blocked copying. Select the code and copy it manually.',
    ],
    [
      ERRORS.CLIPBOARD_NO_USER_GESTURE,
      'Your browser only copies right after a click. Click Copy again, or select the code and copy it manually.',
    ],
    [
      ERRORS.CLIPBOARD_NOT_FOCUSED,
      'Copying needs this tab to be in focus. Click the page, then click Copy again.',
    ],
    [
      ERRORS.CLIPBOARD_UNSUPPORTED,
      "This browser can't copy from this page. Select the code and copy it manually.",
    ],
    [ERRORS.CLIPBOARD_WRITE_FAILED, 'Copying failed. Select the code and copy it manually.'],
    ['SOMETHING_ELSE', 'Copying failed. Select the code and copy it manually.'],
    [null, 'Copying failed. Select the code and copy it manually.'],
  ])('guides %s', (code, guidance) => {
    expect(getCopyGuidance(code, { context: 'code' })).toBe(guidance);
  });

  test.each([
    [
      ERRORS.CLIPBOARD_PERMISSION_DENIED,
      'Your browser blocked copying. Open the link below and copy the text there.',
    ],
    [
      ERRORS.CLIPBOARD_NO_USER_GESTURE,
      'Your browser only copies right after a click. Click Copy again, or open the link below and copy the text there.',
    ],
    [
      ERRORS.CLIPBOARD_NOT_FOCUSED,
      'Copying needs this tab to be in focus. Click the page, then click Copy again.',
    ],
    [
      ERRORS.CLIPBOARD_UNSUPPORTED,
      "This browser can't copy from this page. Open the link below and copy the text there.",
    ],
    [null, 'Copying failed. Open the link below and copy the text there.'],
  ])('guides %s to the link, for text behind one', (code, guidance) => {
    expect(getCopyGuidance(code, { context: 'as Markdown', linked: true })).toBe(guidance);
  });

  test("names the button's own label when it says to click again", () => {
    expect(
      getCopyGuidance(ERRORS.CLIPBOARD_NO_USER_GESTURE, {
        context: 'as Markdown',
        label: 'Copy page',
        linked: true,
      }),
    ).toBe(
      'Your browser only copies right after a click. Click Copy page again, or open the link below and copy the text there.',
    );
    expect(getCopyGuidance(ERRORS.CLIPBOARD_NOT_FOCUSED, { context: 'code', label: null })).toBe(
      'Copying needs this tab to be in focus. Click the page, then click Copy again.',
    );
  });

  test('names what the button copies', () => {
    expect(
      getCopyGuidance(ERRORS.CLIPBOARD_PERMISSION_DENIED, { context: 'npm install command' }),
    ).toBe('Your browser blocked copying. Select the npm install command and copy it manually.');
  });
});
