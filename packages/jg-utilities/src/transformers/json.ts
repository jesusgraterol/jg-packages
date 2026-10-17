import { Exception, getErrorCode } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IJSONValue } from '../shared/types.js';
import { isObjectValid } from '../validations/index.js';

import { sortJSONObjectKeys } from './utilities.js';
import {
  canJSONBeDeserialized,
  canJSONBeSerialized,
  validateJSONDeserializationResult,
  validateJSONSerializationResult,
} from './validations.js';

/**
 * Serializes a JSON object with the JSON.stringify method.
 * @param value The value to be serialized. It should be an object or an array.
 * @returns A string representing the serialized JSON object.
 * @example
 * import { stringifyJSON } from 'jg-utilities';
 *
 * stringifyJSON({ id: 1, tags: ['a'] }); // => '{"id":1,"tags":["a"]}'
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not an object or an array
 * - UNABLE_TO_SERIALIZE_JSON: if the result of JSON.stringify is not a valid string
 * - UNABLE_TO_SERIALIZE_JSON: if an error is thrown during stringification
 */
export const stringifyJSON = <T>(value: T): string => {
  canJSONBeSerialized(value);
  try {
    const result = JSON.stringify(value);
    validateJSONSerializationResult(value, result);
    return result;
  } catch (error) {
    if (getErrorCode(error) !== ERRORS.UNABLE_TO_SERIALIZE_JSON) {
      throw new Exception(`Failed to stringify the JSON value '${String(value)}'.`, {
        code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
        cause: error,
      });
    }
    throw error;
  }
};

/**
 * Stringifies a JSON object in a deterministic way, ensuring that the keys are sorted and the
 * output is consistent.
 * @param value The value to be serialized. It should be an object or an array.
 * @returns A string representing the serialized JSON object with sorted keys.
 * @example
 * import { stringifyJSONDeterministically } from 'jg-utilities';
 *
 * stringifyJSONDeterministically({ b: 1, a: { d: 2, c: 3 } }); // => '{"a":{"c":3,"d":2},"b":1}'
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not an object or an array
 * - UNABLE_TO_SERIALIZE_JSON: if the result of JSON.stringify is not a valid string
 * - UNABLE_TO_SERIALIZE_JSON: if an error is thrown during stringification
 */
export const stringifyJSONDeterministically = <T>(value: T): string => {
  canJSONBeSerialized(value);
  try {
    return stringifyJSON(sortJSONObjectKeys(value) as object);
  } catch (error) {
    if (getErrorCode(error) !== ERRORS.UNABLE_TO_SERIALIZE_JSON) {
      throw new Exception(
        `Failed to stringify the JSON value deterministically '${String(value)}'.`,
        { code: ERRORS.UNABLE_TO_SERIALIZE_JSON, cause: error },
      );
    }
    throw error;
  }
};

/**
 * Deserializes a JSON string with the JSON.parse method.
 * @param value The JSON string to be deserialized.
 * @returns The deserialized object or array.
 * @example
 * import { parseJSON } from 'jg-utilities';
 *
 * const user = parseJSON<{ id: number }>('{"id":1}'); // { id: 1 }
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not a non-empty string
 * - UNABLE_TO_DESERIALIZE_JSON: if the result of JSON.parse is not a valid object or array
 * - UNABLE_TO_DESERIALIZE_JSON: if an error is thrown during parsing
 */
export const parseJSON = <T>(value: string): T => {
  canJSONBeDeserialized(value);
  try {
    const result: unknown = JSON.parse(value);
    validateJSONDeserializationResult(value, result);
    return result as T;
  } catch (error) {
    if (getErrorCode(error) !== ERRORS.UNABLE_TO_DESERIALIZE_JSON) {
      throw new Exception(`Failed to parse the JSON value '${value}'.`, {
        code: ERRORS.UNABLE_TO_DESERIALIZE_JSON,
        cause: error,
      });
    }
    throw error;
  }
};

/**
 * Removes null, undefined, empty objects, and empty arrays from the given data recursively.
 * @param value The value to be pruned. It should be an object, array, or primitive value.
 * @returns The pruned value, or null if the value is empty or invalid.
 * @example
 * import { pruneJSON } from 'jg-utilities';
 *
 * pruneJSON({ a: 1, b: null, c: {}, d: [], e: { f: [] } }); // => { a: 1 }
 */
export const pruneJSON = <T extends IJSONValue>(value: T): T | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => pruneJSON(item))
      .filter((item) => {
        if (item === null || item === undefined) return false;
        if (Array.isArray(item)) return item.length > 0;
        if (isObjectValid(item, true)) return Object.keys(item).length > 0;
        return true;
      });

    // if after cleaning it has no items, return null
    return cleanedArray.length > 0 ? (cleanedArray as T) : null;
  }

  if (isObjectValid(value, true)) {
    const cleanedObject: Record<string, IJSONValue> = {};

    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined) return;
      const cleanedItem = pruneJSON(item);

      if (cleanedItem === null || cleanedItem === undefined) return;
      if (Array.isArray(cleanedItem) && cleanedItem.length === 0) return;
      if (isObjectValid(cleanedItem, true) && !isObjectValid(cleanedItem)) return;

      cleanedObject[key] = cleanedItem;
    });

    // if after cleaning it has no keys, return null
    return Object.keys(cleanedObject).length > 0 ? (cleanedObject as T) : null;
  }

  return value;
};
