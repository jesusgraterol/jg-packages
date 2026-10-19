import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';

/**
 * Builds the exception for an argument that isn't valid.
 * @param name The argument, such as `installationId`.
 * @returns The GITHUB_INVALID_ARGUMENT exception.
 */
export const invalidArgument = (name: string): Exception =>
  new Exception("An argument isn't valid.", {
    code: ERRORS.GITHUB_INVALID_ARGUMENT,
    data: { argument: name },
  });

/**
 * Checks whether a value is a plain object, such as one parsed from JSON.
 * @param value The value.
 * @returns Whether it is.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Checks whether a value can go in an HTTP header: a non-empty string of visible ASCII characters
 * and spaces, without line breaks.
 * @param value The value.
 * @returns Whether it can.
 */
export const isHeaderValue = (value: unknown): value is string =>
  typeof value === 'string' && /^[\x21-\x7e](?:[\x20-\x7e]*[\x21-\x7e])?$/.test(value);
