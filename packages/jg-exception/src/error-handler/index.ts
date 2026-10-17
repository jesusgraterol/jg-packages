import { DEFAULT_MESSAGE } from '../shared/constants.js';
import { extractZodErrorMessage, isZodErrorLike, redactSensitiveValues } from './utilities.js';

/*
 * General errors
 */

// properties that commonly hold an error's message, in the order they're tried
const MESSAGE_PROPERTIES = [
  'message',
  'msg',
  'error',
  'err',
  'errors',
  'errs',
  'reason',
  'reasons',
  'issue',
  'issues',
  'data',
] as const;

/**
 * Extracts an error message while avoiding circular object traversal.
 * @param error The error to extract the message from.
 * @param visitedErrors The object references already inspected in this extraction.
 * @returns The extracted message, or the default message when extraction fails.
 */
const extractMessageFrom = (error: unknown, visitedErrors: WeakSet<object>): string => {
  // a non-empty string is the message itself
  if (typeof error === 'string' && error.length) {
    return error;
  }

  // a ZodError reports its first issue
  if (isZodErrorLike(error)) {
    return extractZodErrorMessage(error);
  }

  if (typeof error !== 'object' || error === null) {
    return DEFAULT_MESSAGE;
  }
  if (visitedErrors.has(error)) {
    return DEFAULT_MESSAGE;
  }
  visitedErrors.add(error);

  // an Error returns its message, followed by its cause's when it has one
  if (error instanceof Error && error.message) {
    if (error.cause) {
      return `${error.message}; [CAUSE]: ${extractMessageFrom(error.cause, visitedErrors)}`;
    }
    return error.message;
  }

  // other objects are searched for a property holding the message, then stringified
  const record = error as Record<string, unknown>;
  const property = MESSAGE_PROPERTIES.find((name) => Boolean(record[name]));
  if (property !== undefined) {
    return extractMessageFrom(record[property], visitedErrors);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return DEFAULT_MESSAGE;
  }
};

/**
 * Extracts a message from an error of any shape: a string, an `Error` (with its causes), a
 * ZodError, or an object holding the message in a common property such as `message`, `error`, or
 * `reason`. Other objects are stringified. When nothing can be extracted, it returns the default
 * message.
 * @param error The error to extract the message from.
 * @returns The extracted message, or `DEFAULT_MESSAGE`.
 * @example
 * extractMessage(new Error('Not found')); // 'Not found'
 * extractMessage({ reason: 'Timed out' }); // 'Timed out'
 * extractMessage(undefined); // DEFAULT_MESSAGE
 */
export const extractMessage = (error: unknown): string => extractMessageFrom(error, new WeakSet());

/**
 * Extracts an error message and replaces every exact, case-sensitive occurrence of the sensitive
 * values with `[redacted]`.
 * @param error The error to extract the message from.
 * @param sensitiveValues The exact values to redact, such as tokens or passwords.
 * @returns The extracted message with the sensitive values redacted.
 * @example
 * extractRedactedMessage(new Error('Bad token abc123'), ['abc123']); // 'Bad token [redacted]'
 */
export const extractRedactedMessage = (error: unknown, sensitiveValues: string[]): string =>
  redactSensitiveValues(extractMessage(error), sensitiveValues);

/*
 * Code helpers
 */

/**
 * Reads an error's code: the non-empty string in its `code` property, as on an Exception, a
 * Node.js system error, or a provider's error object.
 * @param error The error to read, of any shape.
 * @returns The code, or `null` when the error has none.
 * @example
 * getErrorCode(new Exception('Not found', { code: 'NOT_FOUND' })); // 'NOT_FOUND'
 * getErrorCode(new Error('Not found')); // null
 */
export const getErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const { code } = error as { code?: unknown };
  return typeof code === 'string' && code.length > 0 ? code : null;
};

/**
 * Checks whether an error's code, or the error itself when it's a string, starts with a prefix.
 * @param error The error to check, of any shape.
 * @param prefix The non-empty prefix to look for.
 * @returns Whether the code starts with the prefix; always `false` for an empty prefix.
 * @example
 * hasErrorCodePrefix(new Exception('Denied', { code: 'AUTH_EXPIRED' }), 'AUTH_'); // true
 */
export const hasErrorCodePrefix = (error: unknown, prefix: string): boolean => {
  if (prefix.length === 0) {
    return false;
  }

  const code = getErrorCode(error) ?? error;

  return typeof code === 'string' && code.startsWith(prefix);
};

/**
 * Checks whether an error has a code. The error may also be the code itself.
 * @param error The error to check, of any shape.
 * @param code The code to look for.
 * @returns Whether the error has the code.
 * @example
 * hasErrorCode(new Exception('Not found', { code: 'NOT_FOUND' }), 'NOT_FOUND'); // true
 * hasErrorCode('NOT_FOUND', 'NOT_FOUND'); // true
 */
export const hasErrorCode = (error: unknown, code: string): boolean =>
  code.length > 0 && (typeof error === 'string' ? error : getErrorCode(error)) === code;

/**
 * Checks whether a value is, or contains, the default message the package falls back to.
 * @param value The value to check.
 * @param fullMatch Whether the whole value must be the default message.
 * @returns Whether the value matches the default message.
 * @example
 * isDefaultErrorMessage(extractMessage(undefined), true); // true
 */
export const isDefaultErrorMessage = (
  value: string,
  fullMatch: boolean = false,
): value is string =>
  fullMatch
    ? value === DEFAULT_MESSAGE
    : typeof value === 'string' && value.includes(DEFAULT_MESSAGE);
