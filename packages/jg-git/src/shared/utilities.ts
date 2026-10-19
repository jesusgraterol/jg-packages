import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';

// an object ID: SHA-1's 40 hexadecimal characters, or SHA-256's 64
const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * Builds the exception for an argument that isn't valid.
 * @param name The argument, such as `rev`.
 * @returns The GIT_INVALID_ARGUMENT exception.
 */
export const invalidArgument = (name: string): Exception =>
  new Exception("An argument isn't valid.", {
    code: ERRORS.GIT_INVALID_ARGUMENT,
    data: { argument: name },
  });

/**
 * Builds the exception for output that isn't in the expected format.
 * @param subcommand The git subcommand that wrote it.
 * @returns The GIT_OUTPUT_INVALID exception.
 */
export const invalidOutput = (subcommand: string): Exception =>
  new Exception("Git's output isn't in the expected format.", {
    code: ERRORS.GIT_OUTPUT_INVALID,
    data: { subcommand },
  });

/**
 * Checks whether a value is a full object ID, in lowercase hexadecimal.
 * @param value The value.
 * @returns Whether it is.
 */
export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

/**
 * Checks whether a value is a non-empty string without a null character, which Git can take as an
 * argument.
 * @param value The value.
 * @returns Whether it is.
 */
export const isArgumentValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !value.includes('\0');
