import { extractMessage } from 'jg-exception';

import type { IAPIResponse, IParsedAPIResponse } from './types.js';

/**
 * Builds the envelope for an HTTP body. The response is successful when no error is passed; any
 * error that is passed, even a falsy one, becomes its message. A failed response can carry data
 * too.
 * @param data The data to send.
 * @param error The error the request failed with, of any shape.
 * @returns The envelope.
 * @example
 * buildResponse({ id: 1 }); // { success: true, data: { id: 1 }, error: undefined }
 * buildResponse(undefined, new Error('Not found')); // { success: false, data: undefined, error: 'Not found' }
 */
export const buildResponse = <T = undefined>(data?: T, error?: unknown): IAPIResponse<T> => ({
  success: error === undefined,
  data: data as T,
  error: error === undefined ? undefined : extractMessage(error),
});

/**
 * Checks whether a value is an envelope, including one parsed from JSON: an object with a boolean
 * `success`, an `error` that is a string, `null`, or missing, and any `data` or none.
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
    (error === undefined || error === null || typeof error === 'string')
  );
};
