import { Exception, isException } from 'jg-exception';

import { ERRORS } from './errors.js';
import { browserGlobals } from './globals.js';
import type { IClipboardOperation } from './types.js';

/**
 * Builds the error for a clipboard feature the page can't use.
 * @param action What the page tried to do, such as 'copy text'.
 * @returns The CLIPBOARD_UNSUPPORTED error.
 */
export const unsupported = (action: string): Exception =>
  new Exception(
    `The clipboard can't ${action} here: it needs a secure context, such as HTTPS, and a browser that supports it.`,
    { code: ERRORS.CLIPBOARD_UNSUPPORTED },
  );

/**
 * Builds the error for a clipboard operation that failed for a reason the browser didn't name.
 * @param operation The operation.
 * @param cause The browser's error.
 * @returns The CLIPBOARD_WRITE_FAILED or CLIPBOARD_READ_FAILED error.
 */
export const operationFailed = (operation: IClipboardOperation, cause: unknown): Exception =>
  operation === 'write'
    ? new Exception("The content couldn't be copied to the clipboard.", {
        code: ERRORS.CLIPBOARD_WRITE_FAILED,
        cause,
      })
    : new Exception("The clipboard couldn't be read.", {
        code: ERRORS.CLIPBOARD_READ_FAILED,
        cause,
      });

/**
 * Checks whether an error is the browser refusing the operation.
 * @param error The error.
 * @returns Whether it's a NotAllowedError.
 */
const isNotAllowedError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'NotAllowedError';

/**
 * Asks the Permissions API for the clipboard permission's state, where the browser has it.
 * @param operation The operation, whose permission is clipboard-write or clipboard-read.
 * @returns A promise that resolves to the state, or null when the browser can't say.
 */
const queryPermission = async (operation: IClipboardOperation): Promise<PermissionState | null> => {
  const permissions = browserGlobals.navigator?.permissions;
  if (typeof permissions?.query !== 'function') {
    return null;
  }
  try {
    return (await permissions.query({ name: `clipboard-${operation}` })).state;
  } catch {
    // some browsers don't know the clipboard permissions, and reject the query
    return null;
  }
};

/**
 * Names why a clipboard operation failed. When the browser refused it with a NotAllowedError, the
 * reason is an unfocused page, then a missing click or key press where the browser reports user
 * activation, then the permission, unless the Permissions API says it's granted. Anything else is a
 * failed write or read. An Exception passes through unchanged, and every other error is the cause.
 * @param error What the operation threw.
 * @param operation The operation.
 * @returns A promise that resolves to the error to throw.
 */
export const toClipboardException = async (
  error: unknown,
  operation: IClipboardOperation,
): Promise<Exception> => {
  if (isException(error)) {
    return error;
  }
  if (!isNotAllowedError(error)) {
    return operationFailed(operation, error);
  }
  const { document, navigator } = browserGlobals;
  if (typeof document?.hasFocus === 'function' && !document.hasFocus()) {
    return new Exception('The page must have focus to use the clipboard.', {
      code: ERRORS.CLIPBOARD_NOT_FOCUSED,
      cause: error,
    });
  }
  if (navigator?.userActivation?.isActive === false) {
    return new Exception('The browser only allows this right after a click or a key press.', {
      code: ERRORS.CLIPBOARD_NO_USER_GESTURE,
      cause: error,
    });
  }
  const permission = await queryPermission(operation);
  if (permission === 'granted') {
    return operationFailed(operation, error);
  }
  return new Exception('The permission to use the clipboard was denied.', {
    code: ERRORS.CLIPBOARD_PERMISSION_DENIED,
    data: { permission },
    cause: error,
  });
};
