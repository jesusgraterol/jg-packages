import { Exception } from 'jg-exception';

import { ERRORS, type ISchema } from '../shared/index.js';
import { buildInvalidError, parseJson } from '../shared/utilities.js';
import type { IEnvironmentReader, IEnvironmentSource } from './types.js';

// an integer in plain decimal digits: no sign on zero, no leading zeros, exponent, or padding
const CANONICAL_INTEGER = /^(?:0|-?[1-9]\d*)$/;

/**
 * Creates the readers for a source of environment variables. Each read looks the variable up
 * again, so it sees the source's current value. A variable is unset when the source doesn't hold
 * it, or holds an empty or blank string; any other value that isn't a string is invalid. Errors
 * name the variable and never its value.
 * @param source Where the variables come from, such as process.env or Vite's import.meta.env.
 * @returns The readers.
 * @example
 * import { createEnvironmentReader } from 'jg-env';
 *
 * const { readEnum, readInteger, readString } = createEnvironmentReader({
 *   NODE_ENV: 'production',
 *   PORT: '8080',
 *   DATABASE_HOST: 'db.internal',
 * });
 *
 * readString('DATABASE_HOST'); // 'db.internal'
 * readInteger('PORT'); // 8080
 * readEnum('NODE_ENV', ['development', 'production']); // 'production'
 */
export const createEnvironmentReader = (source: IEnvironmentSource): IEnvironmentReader => {
  const subjectOf = (key: string): string => `The environment variable ${key}`;

  /**
   * Reads a variable's value, when it's set.
   * @param key The variable's name.
   * @returns The value, or undefined when the variable is unset.
   * @throws
   * - ENV_VARIABLE_INVALID: The environment variable is not a string.
   */
  const readValue = (key: string): string | undefined => {
    // only the source's own entries count, so a key such as toString reads nothing inherited
    const value = Object.hasOwn(source, key) ? source[key] : undefined;
    if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw buildInvalidError(subjectOf(key), key, 'is not a string');
    }
    return value;
  };

  const readRequired = (key: string): string => {
    const value = readValue(key);
    if (value === undefined) {
      throw new Exception(`${subjectOf(key)} is not set.`, {
        code: ERRORS.ENV_VARIABLE_MISSING,
        data: { key },
      });
    }
    return value;
  };

  const toBoolean = (key: string, value: string): boolean => {
    if (value !== 'true' && value !== 'false') {
      throw buildInvalidError(subjectOf(key), key, 'is not true or false');
    }
    return value === 'true';
  };

  const toInteger = (key: string, value: string): number => {
    const integer = Number(value);
    if (!CANONICAL_INTEGER.test(value) || !Number.isSafeInteger(integer)) {
      throw buildInvalidError(subjectOf(key), key, 'is not a safe integer in plain decimal digits');
    }
    return integer;
  };

  const readOptional = <T>(key: string, convert: (value: string) => T): T | undefined => {
    const value = readValue(key);
    return value === undefined ? undefined : convert(value);
  };

  return {
    readString: readRequired,
    readEnum: <const T extends string>(key: string, values: readonly T[]): T => {
      const value = readRequired(key);
      if (!(values as readonly string[]).includes(value)) {
        throw buildInvalidError(subjectOf(key), key, `is not one of ${values.join(', ')}`, {
          allowedValues: [...values],
        });
      }
      return value as T;
    },
    readBoolean: (key) => toBoolean(key, readRequired(key)),
    readInteger: (key) => toInteger(key, readRequired(key)),
    readJson: <T>(key: string, schema: ISchema<T>): T =>
      parseJson(subjectOf(key), key, readRequired(key), schema),
    readOptionalString: (key) => readValue(key),
    readOptionalBoolean: (key) => readOptional(key, (value) => toBoolean(key, value)),
    readOptionalInteger: (key) => readOptional(key, (value) => toInteger(key, value)),
    readOptionalJson: <T>(key: string, schema: ISchema<T>): T | undefined =>
      readOptional(key, (value) => parseJson(subjectOf(key), key, value, schema)),
  };
};
