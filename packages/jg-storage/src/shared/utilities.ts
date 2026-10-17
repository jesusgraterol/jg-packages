import { Exception } from 'jg-exception';

import { KEY_NAMESPACE, STORE_ID_PATTERN } from './constants.js';
import { ERRORS } from './errors.js';
import type { IRecordId, IStoreMechanism, IStoreOptions } from './types.js';

/**
 * Checks that a store id holds only letters, digits, underscores, and hyphens.
 * @param storeId The store's identifier.
 * @throws
 * - INVALID_STORE_ID: The store id must hold only letters, digits, underscores, and hyphens.
 */
export const assertStoreId = (storeId: string): void => {
  if (typeof storeId !== 'string' || !STORE_ID_PATTERN.test(storeId)) {
    throw new Exception(
      `The store id '${String(storeId)}' must hold only letters, digits, underscores, and hyphens.`,
      { code: ERRORS.INVALID_STORE_ID },
    );
  }
};

/**
 * Builds the web storage key a record is stored under: `jg-storage:<storeId>` for the root record,
 * and `jg-storage:<storeId>:<recordId>` for the others. Record ids become strings, so `1` and `'1'`
 * share a record.
 * @param storeId The store's identifier.
 * @param recordId The record's identifier, or undefined for the store's root record.
 * @returns The key.
 */
export const buildDataKey = (storeId: string, recordId: IRecordId): string =>
  recordId === undefined
    ? `${KEY_NAMESPACE}:${storeId}`
    : `${KEY_NAMESPACE}:${storeId}:${String(recordId)}`;

/**
 * Builds the IndexedDB key a record is stored under: `[storeId]` for the root record, and
 * `[storeId, recordId]` for the others, with the record id as a string, as in web storage.
 * @param storeId The store's identifier.
 * @param recordId The record's identifier, or undefined for the store's root record.
 * @returns The key.
 */
export const buildIndexedDbKey = (storeId: string, recordId: IRecordId): string[] =>
  recordId === undefined ? [storeId] : [storeId, String(recordId)];

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
export const parseJson = (data: string): unknown => {
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
export const stringifyJson = (value: unknown): string => {
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
