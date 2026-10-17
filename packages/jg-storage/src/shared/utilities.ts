import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';
import type { IRecordId, IStoreMechanism, IStoreOptions } from './types.js';

/**
 * Builds the key a record is stored under, the same one browser-keyval-stores used.
 * @param storeId The store's identifier.
 * @param recordId The record's identifier, or undefined for the store's root record.
 * @returns The key.
 */
export const buildDataKey = (storeId: string, recordId: IRecordId): string =>
  recordId === undefined ? storeId : `${storeId}_${recordId}`;

/**
 * Validates a stored value with the store's schema, or returns it as it is without one.
 * @param value The stored value.
 * @param options The store's options.
 * @returns The value.
 */
export const parseValue = <T>(value: unknown, options: IStoreOptions<T>): T =>
  options.schema === undefined ? (value as T) : options.schema.parse(value);

/**
 * Parses a value read from web storage.
 * @param data The stored text.
 * @returns The value.
 * @throws
 * - FAILED_TO_PARSE_JSON: Unable to parse the JSON data.
 */
export const parseJSON = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new Exception('Unable to parse the JSON data.', {
      code: ERRORS.FAILED_TO_PARSE_JSON,
      cause: error,
    });
  }
};

/**
 * Serializes a value to be written to web storage.
 * @param value The value.
 * @returns The JSON text.
 * @throws
 * - FAILED_TO_STRINGIFY_JSON: Unable to stringify the JSON data.
 */
export const stringifyJSON = (value: unknown): string => {
  let data: string | undefined;
  try {
    data = JSON.stringify(value);
  } catch (error) {
    throw new Exception('Unable to stringify the JSON data.', {
      code: ERRORS.FAILED_TO_STRINGIFY_JSON,
      cause: error,
    });
  }

  // JSON.stringify returns undefined for undefined, functions, and symbols
  if (data === undefined) {
    throw new Exception(
      `Unable to stringify the JSON data: JSON can't represent a value of type '${typeof value}'.`,
      { code: ERRORS.FAILED_TO_STRINGIFY_JSON },
    );
  }
  return data;
};

/**
 * Builds the error a store without a fallback throws when it writes to an unavailable mechanism.
 * @param storeId The store's identifier.
 * @param mechanism The mechanism that's unavailable.
 * @returns The error.
 */
export const buildUnavailableException = (storeId: string, mechanism: IStoreMechanism): Exception =>
  new Exception(
    `The store '${storeId}' can't write because ${mechanism} is unavailable. Pass { fallback: 'memory' } to keep its records in memory instead.`,
    { code: ERRORS.STORE_UNAVAILABLE },
  );
