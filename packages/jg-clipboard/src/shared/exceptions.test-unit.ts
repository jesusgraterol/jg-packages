import { Exception } from 'jg-exception';
import { describe, expect, test } from 'vitest';

import { domError, installFakeBrowser } from './browser.test-utils.js';
import { ERRORS } from './errors.js';
import { toClipboardException, unsupported } from './exceptions.js';

describe('unsupported', () => {
  test('names the action and the requirements', () => {
    expect(unsupported('copy images')).toMatchObject({
      code: ERRORS.CLIPBOARD_UNSUPPORTED,
      message:
        "The clipboard can't copy images here: it needs a secure context, such as HTTPS, and a browser that supports it.",
    });
  });
});

describe('toClipboardException', () => {
  test('passes an Exception through unchanged', async () => {
    installFakeBrowser();
    const exception = new Exception('Bad image', { code: ERRORS.CLIPBOARD_INVALID_IMAGE });

    await expect(toClipboardException(exception, 'write')).resolves.toBe(exception);
  });

  test.each([
    ['write', ERRORS.CLIPBOARD_WRITE_FAILED, "The content couldn't be copied to the clipboard."],
    ['read', ERRORS.CLIPBOARD_READ_FAILED, "The clipboard couldn't be read."],
  ] as const)(
    'names any error but a NotAllowedError a failed %s, keeping it as the cause',
    async (operation, code, message) => {
      installFakeBrowser();
      const error = domError('DataError');

      await expect(toClipboardException(error, operation)).resolves.toMatchObject({
        code,
        message,
        cause: error,
      });
    },
  );

  test('names a refusal in an unfocused page CLIPBOARD_NOT_FOCUSED, before anything else', async () => {
    const { query } = installFakeBrowser({
      hasFocus: false,
      userActivation: false,
      permission: 'denied',
    });
    const error = domError('NotAllowedError');

    await expect(toClipboardException(error, 'write')).resolves.toMatchObject({
      code: ERRORS.CLIPBOARD_NOT_FOCUSED,
      message: 'The page must have focus to use the clipboard.',
      cause: error,
    });
    expect(query).not.toHaveBeenCalled();
  });

  test('names a refusal without an active click CLIPBOARD_NO_USER_GESTURE', async () => {
    const { query } = installFakeBrowser({ userActivation: false, permission: 'denied' });
    const error = domError('NotAllowedError');

    await expect(toClipboardException(error, 'read')).resolves.toMatchObject({
      code: ERRORS.CLIPBOARD_NO_USER_GESTURE,
      message: 'The browser only allows this right after a click or a key press.',
      cause: error,
    });
    expect(query).not.toHaveBeenCalled();
  });

  test.each([
    ['write', 'denied', 'clipboard-write'],
    ['read', 'prompt', 'clipboard-read'],
  ] as const)(
    'names a %s refusal with the permission %s CLIPBOARD_PERMISSION_DENIED, from the Permissions API',
    async (operation, permission, name) => {
      const { query } = installFakeBrowser({ permission });
      const error = domError('NotAllowedError');

      await expect(toClipboardException(error, operation)).resolves.toMatchObject({
        code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
        message: 'The permission to use the clipboard was denied.',
        data: { permission },
        cause: error,
      });
      expect(query).toHaveBeenCalledWith({ name });
    },
  );

  test('names a refusal with the permission granted a failed operation', async () => {
    installFakeBrowser({ permission: 'granted' });
    const error = domError('NotAllowedError');

    await expect(toClipboardException(error, 'write')).resolves.toMatchObject({
      code: ERRORS.CLIPBOARD_WRITE_FAILED,
      cause: error,
    });
  });

  test.each([
    ['without the Permissions API', undefined],
    ['when the browser rejects the clipboard permission names', 'unknown'],
  ] as const)(
    'names a refusal CLIPBOARD_PERMISSION_DENIED %s, with no permission state',
    async (_, permission) => {
      installFakeBrowser({ permission });

      await expect(
        toClipboardException(domError('NotAllowedError'), 'read'),
      ).resolves.toMatchObject({
        code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
        data: { permission: null },
      });
    },
  );

  test('skips the click check in a browser without userActivation', async () => {
    installFakeBrowser({ userActivation: undefined, permission: 'denied' });

    await expect(toClipboardException(domError('NotAllowedError'), 'write')).resolves.toMatchObject(
      { code: ERRORS.CLIPBOARD_PERMISSION_DENIED },
    );
  });
});
