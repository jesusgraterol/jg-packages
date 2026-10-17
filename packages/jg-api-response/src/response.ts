import { extractMessage, getErrorCode, isException, UNKNOWN_ERROR_CODE } from 'jg-exception';

import type { IAPIError, IAPIResponse, IParsedAPIError, IParsedAPIResponse } from './types.js';

/**
 * Turns an error of any shape into the error an envelope carries.
 * @param error The error the request failed with.
 * @returns An Exception's code, message, and data, or any other error's string `code` (or
 * `UNKNOWN_ERROR`) and message, with `null` data.
 */
const toAPIError = (error: unknown): IAPIError => {
  if (isException(error)) {
    const { code, message, data } = error.toJSON();
    return { code, message, data };
  }
  return {
    code: getErrorCode(error) ?? UNKNOWN_ERROR_CODE,
    message: extractMessage(error),
    data: null,
  };
};

/**
 * Checks whether a value is an envelope error: an object with a string `code` and `message`.
 * @param value The value to check.
 * @returns Whether the value is an envelope error.
 */
const isParsedAPIError = (value: unknown): value is IParsedAPIError => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { code, message } = value as Record<string, unknown>;
  return typeof code === 'string' && typeof message === 'string';
};

/**
 * Builds the envelope for an HTTP body. The response is successful when no error is passed. Any
 * error that is passed, even a falsy one, becomes `{ code, message, data }`: an Exception keeps all
 * three, and any other error keeps its string `code`, or gets `UNKNOWN_ERROR`, and its message. A
 * failed response can carry data too.
 * @param data The data to send.
 * @param error The error the request failed with, of any shape.
 * @returns The envelope, which `JSON.stringify` can always serialize when the data can.
 * @example
 * buildResponse({ id: 1 }); // { success: true, data: { id: 1 }, error: null }
 * buildResponse(undefined, new Exception('Not found', { code: 'NOT_FOUND', data: { id: 1 } }));
 * // { success: false, data: undefined, error: { code: 'NOT_FOUND', message: 'Not found', data: { id: 1 } } }
 */
export const buildResponse = <T = undefined>(data?: T, error?: unknown): IAPIResponse<T> => ({
  success: error === undefined,
  data: data as T,
  error: error === undefined ? null : toAPIError(error),
});

/**
 * Checks whether a value is an envelope, including one parsed from JSON or sent by another
 * service: an object with a boolean `success`, an `error` that is `null`, missing, or an object
 * with a string `code` and `message`, and any `data` or none. The error's `data` isn't checked.
 * @param value The value to check, such as a parsed response body.
 * @returns Whether the value is an envelope.
 * @example
 * const body: unknown = await response.json();
 * if (isResponse<IUser>(body) && body.success) {
 *   body.data; // IUser | undefined
 * }
 */
export const isResponse = <T>(value: unknown): value is IParsedAPIResponse<T> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const { success, error } = value as Record<string, unknown>;
  return (
    typeof success === 'boolean' &&
    (error === undefined || error === null || isParsedAPIError(error))
  );
};
