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
    expect(getCopyGuidance(code, 'code')).toBe(guidance);
  });

  test('names what the button copies', () => {
    expect(getCopyGuidance(ERRORS.CLIPBOARD_PERMISSION_DENIED, 'npm install command')).toBe(
      'Your browser blocked copying. Select the npm install command and copy it manually.',
    );
  });
});
