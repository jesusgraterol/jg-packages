import { Buffer } from 'node:buffer';
import { Exception, extractMessage } from 'jg-exception';

import { ERRORS } from './errors.js';

/*
 * The checks and exceptions both entries share, so the async and sync functions validate data and
 * report errors identically.
 */

/**
 * Builds the exception for a path that isn't a file.
 * @param path The path.
 * @returns The NOT_A_FILE exception.
 */
export const notAFile = (path: string): Exception =>
  new Exception(`The path '${path}' is not a file.`, { code: ERRORS.NOT_A_FILE });

/**
 * Builds the exception for a path that isn't a directory.
 * @param path The path.
 * @returns The NOT_A_DIRECTORY exception.
 */
export const notADirectory = (path: string): Exception =>
  new Exception(`The path '${path}' is not a directory.`, { code: ERRORS.NOT_A_DIRECTORY });

/**
 * Builds the exception for a file larger than a bounded read allows.
 * @param path The path.
 * @param maxBytes The limit.
 * @returns The FILE_TOO_LARGE exception.
 */
export const fileTooLarge = (path: string, maxBytes: number): Exception =>
  new Exception(`The file '${path}' is larger than ${maxBytes} bytes.`, {
    code: ERRORS.FILE_TOO_LARGE,
  });

/**
 * Ensures text written to a file is a string. An empty string is valid and writes an empty file.
 * @param path The file's path.
 * @param data The text.
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a string
 */
export const assertTextData = (path: string, data: unknown): void => {
  if (typeof data !== 'string') {
    throw new Exception(
      `The data for the file '${path}' must be a string. Received: ${typeof data}`,
      { code: ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID },
    );
  }
};

/**
 * Ensures data written to a binary file is a Buffer. An empty Buffer is valid.
 * @param path The file's path.
 * @param data The data.
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the data isn't a Buffer
 */
export const assertBufferData = (path: string, data: unknown): void => {
  if (!Buffer.isBuffer(data)) {
    throw new Exception(
      `The data for the file '${path}' must be a Buffer. Received: ${typeof data}`,
      { code: ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID },
    );
  }
};

/**
 * Turns data into the JSON text of a file: a string is written as given, and anything else is
 * stringified. JSON can't be empty, so an empty result is rejected.
 * @param path The file's path.
 * @param data The data, or its JSON text.
 * @param space The indentation for stringified data.
 * @returns The JSON text.
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the JSON content cannot be stringified or is empty
 */
export const serializeJSONData = (path: string, data: unknown, space: number): string => {
  let text: unknown;
  try {
    text = typeof data === 'string' ? data : JSON.stringify(data, undefined, space);
  } catch (error) {
    throw new Exception(
      `The JSON data for the file '${path}' could not be stringified: ${extractMessage(error)}`,
      { code: ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID },
    );
  }
  if (typeof text !== 'string' || text === '') {
    throw new Exception(`The JSON data for the file '${path}' is empty.`, {
      code: ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    });
  }
  return text;
};

/**
 * Parses a JSON file's text.
 * @param path The file's path.
 * @param content The file's text.
 * @returns The parsed value.
 * @throws
 * - FILE_CONTENT_IS_EMPTY_OR_INVALID: if the file's JSON content cannot be parsed
 */
export const parseJSONContent = <T>(path: string, content: string): T => {
  try {
    return JSON.parse(content) as T;
  } catch (error) {
    throw new Exception(`The JSON file '${path}' could not be parsed: ${extractMessage(error)}`, {
      code: ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    });
  }
};

/**
 * Checks whether an error is a missing-path error from Node.js.
 * @param error The error.
 * @returns Whether its code is ENOENT.
 */
export const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

/**
 * Builds the exception for a bounded read whose path doesn't exist or ends in a symbolic link.
 * @param path The path.
 * @param error The error opening it.
 * @returns The NOT_A_FILE exception.
 */
export const notARegularFile = (path: string, error: unknown): Exception =>
  new Exception(
    `The file '${path}' doesn't exist or is a symbolic link: ${extractMessage(error)}`,
    { code: ERRORS.NOT_A_FILE },
  );

/**
 * Checks whether opening a path without following links failed because it doesn't exist or its
 * last component is a link (ELOOP, or EMLINK on some BSDs).
 * @param error The error.
 * @returns Whether it means the path isn't a regular file to read.
 */
export const isNoFollowError = (error: unknown): boolean =>
  error instanceof Error &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ELOOP' || error.code === 'EMLINK');
