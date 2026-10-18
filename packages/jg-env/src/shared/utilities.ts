import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';
import type { ISchema } from './types.js';

/**
 * Builds the error for a value that's set but can't be used. It has no cause: a parser's or a
 * schema's error can quote the value, which must never reach a log.
 * @param subject What was read, such as "The environment variable PORT".
 * @param key The variable's name.
 * @param reason Why the value can't be used, such as "is not true or false".
 * @param data More context for the error's data, which never holds the value.
 * @returns The error.
 */
export const buildInvalidError = (
  subject: string,
  key: string,
  reason: string,
  data: Record<string, string | string[]> = {},
): Exception =>
  new Exception(`${subject} ${reason}.`, {
    code: ERRORS.ENV_VARIABLE_INVALID,
    data: { key, ...data },
  });

/**
 * Parses a value as JSON and checks it with a schema.
 * @param subject What was read, such as "The environment variable FEATURES".
 * @param key The variable's name.
 * @param text The value.
 * @param schema The schema it must match.
 * @returns The value the schema returns.
 * @throws
 * - ENV_VARIABLE_INVALID: The value is not valid JSON, or doesn't match its schema.
 */
export const parseJson = <T>(subject: string, key: string, text: string, schema: ISchema<T>): T => {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw buildInvalidError(subject, key, 'is not valid JSON');
  }
  try {
    return schema.parse(value);
  } catch {
    throw buildInvalidError(subject, key, "doesn't match its schema");
  }
};
