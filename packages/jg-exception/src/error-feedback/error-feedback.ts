import { getErrorCode } from '../error-handler/index.js';
import type { IErrorFeedback, IErrorFeedbackOptions, IErrorFeedbackOverrides } from './types.js';

/**
 * Copies a table of copy by code, keeping only its own entries whose copy is a string, so changing
 * the table later or a key such as `__proto__` can't change what users read.
 * @param messages The table.
 * @returns The copy, by code.
 */
const copyMessages = (
  messages: Readonly<Record<string, string>> | undefined,
): Map<string, string> =>
  new Map(
    Object.entries(messages ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );

/**
 * Reads the copy one call's overrides give a code, through its own entries only.
 * @param messages The overrides' table.
 * @param code The error's code.
 * @returns The copy, or `undefined` when the table has none for the code.
 */
const readOverrideMessage = (
  messages: Readonly<Record<string, string>> | undefined,
  code: string,
): string | undefined => {
  // a table that isn't an object comes from a caller that skips type checking
  if (typeof messages !== 'object' || messages === null || !Object.hasOwn(messages, code)) {
    return undefined;
  }
  const message: unknown = messages[code];
  return typeof message === 'string' ? message : undefined;
};

/**
 * Reads an error's code without letting an error shaped to throw, such as a proxy, escape.
 * @param error The error.
 * @returns The code, or `null`.
 */
const readCode = (error: unknown): string | null => {
  try {
    return getErrorCode(error);
  } catch {
    return null;
  }
};

/**
 * Checks whether an error is an `AbortError`, such as a cancelled fetch's, without letting an error
 * shaped to throw escape.
 * @param error The error.
 * @returns Whether it's an AbortError.
 */
const isAbortError = (error: unknown): boolean => {
  try {
    return error instanceof Error && error.name === 'AbortError';
  } catch {
    return false;
  }
};

/**
 * Creates the function a UI turns errors into feedback with: the copy users read for the error's
 * code, the code itself when it's safe to show, and whether the error means the user cancelled the
 * work or isn't allowed to do it. Configure it once, and pass overrides where a screen needs copy of
 * its own. A code is shown only when a table gives it copy or `publicCodePattern` matches it, so a
 * new or internal code never reaches users, and the error's message, written for whoever debugs it,
 * is never shown.
 * @param options The fallback copy, and optionally the copy by code, the access-denied codes, and
 * the pattern of codes that are safe to show.
 * @returns A function that gives an error's feedback, with optional overrides for one call. It
 * never throws, whatever error it's given.
 * @example
 * import { Exception, createErrorFeedback } from 'jg-exception';
 *
 * const getErrorFeedback = createErrorFeedback({
 *   fallbackMessage: 'Something went wrong. Try again in a moment.',
 *   messagesByCode: { SESSION_EXPIRED: 'Your session expired. Sign in again to continue.' },
 *   accessDeniedCodes: ['SESSION_EXPIRED'],
 * });
 * const feedback = getErrorFeedback(new Exception('Expired', { code: 'SESSION_EXPIRED' }));
 * feedback.message; // => 'Your session expired. Sign in again to continue.'
 * feedback.code; // => 'SESSION_EXPIRED'
 * feedback.isAccessDenied; // => true
 *
 * // an error without copy gets the fallback, and its code stays hidden
 * getErrorFeedback(new Exception('Disk full', { code: 'DISK_FULL' })).code; // => null
 * @example
 * import { Exception, createErrorFeedback } from 'jg-exception';
 *
 * const getErrorFeedback = createErrorFeedback({
 *   fallbackMessage: 'Something went wrong.',
 *   // codes such as AVATAR_TOO_LARGE are safe to show next to the fallback, for support requests
 *   publicCodePattern: /^AVATAR_/,
 * });
 * const error = new Exception('The avatar is larger than 5 MB.', { code: 'AVATAR_TOO_LARGE' });
 * getErrorFeedback(error).code; // => 'AVATAR_TOO_LARGE'
 *
 * // one screen gives the code copy of its own
 * const overrides = { messagesByCode: { AVATAR_TOO_LARGE: 'Choose an image of 5 MB or less.' } };
 * getErrorFeedback(error, overrides).message; // => 'Choose an image of 5 MB or less.'
 */
export const createErrorFeedback = ({
  fallbackMessage,
  messagesByCode,
  accessDeniedCodes,
  publicCodePattern,
}: IErrorFeedbackOptions): ((
  error: unknown,
  overrides?: IErrorFeedbackOverrides,
) => IErrorFeedback) => {
  const messages = copyMessages(messagesByCode);
  const deniedCodes = new Set(accessDeniedCodes ?? []);
  // without the global and sticky flags, so `test` keeps no position between calls
  const publicCodes =
    publicCodePattern === undefined
      ? undefined
      : new RegExp(publicCodePattern.source, publicCodePattern.flags.replace(/[gy]/g, ''));

  return (error, overrides) => {
    const code = readCode(error);
    const message =
      code === null
        ? undefined
        : (readOverrideMessage(overrides?.messagesByCode, code) ?? messages.get(code));
    const overrideFallback = overrides?.fallbackMessage;
    return {
      message:
        message ?? (typeof overrideFallback === 'string' ? overrideFallback : fallbackMessage),
      code:
        code !== null && (message !== undefined || publicCodes?.test(code) === true) ? code : null,
      isCancelled: isAbortError(error),
      isAccessDenied: code !== null && deniedCodes.has(code),
    };
  };
};
