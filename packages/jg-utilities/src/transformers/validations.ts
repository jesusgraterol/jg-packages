import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import {
  isArrayValid,
  isIntegerValid,
  isObjectValid,
  isStringValid,
} from '../validations/index.js';

import type { ITimeString } from './types.js';

/* ************************************************************************************************
 *                                          TIME STRING                                            *
 ************************************************************************************************ */

/**
 * Ensures a provided time string is valid and can be parsed by the toMS function.
 * @param str The time string to validate.
 * @throws
 * - INVALID_TIME_STRING: if the provided time string is not a valid string.
 */
export const validateTimeStringType = (str: ITimeString): void => {
  if (!isStringValid(str, 5, 100)) {
    throw new Exception(
      `The provided time string is invalid, it must be a string with length between 5 and 100. Received: ${String(str)}`,
      { code: ERRORS.INVALID_TIME_STRING },
    );
  }
};

/**
 * Ensures the chunks obtained from splitting a time string are valid and can be parsed by the toMS function.
 * @param chunks The chunks obtained from splitting a time string.
 * @throws
 * - INVALID_TIME_STRING: if the chunks do not match the expected format.
 */
export const validateTimeStringChunks = (chunks: string[]): void => {
  if (chunks.length !== 2) {
    throw new Exception(
      `The format of the provided time string is invalid, it must match the expected format {value} {unit}. For example: '2 days'. Received: ${JSON.stringify(chunks)}`,
      { code: ERRORS.INVALID_TIME_STRING },
    );
  }
};

/**
 * Ensures the value obtained from a time string is a valid positive integer that can be parsed by the toMS function.
 * @param value The value to validate.
 * @throws
 * - INVALID_TIME_STRING: if the value is not a valid positive integer.
 */
export const validateTimeStringValue = (value: number): void => {
  if (!isIntegerValid(value, 1)) {
    throw new Exception(
      `The value of the provided time string is invalid, it must be a positive integer. Received: ${String(value)}`,
      { code: ERRORS.INVALID_TIME_STRING },
    );
  }
};

/* ************************************************************************************************
 *                                             JSON                                               *
 ************************************************************************************************ */

/**
 * Checks if a JSON value can be serialized (JSON.stringify).
 * @param value The value to check for JSON serialization. It should be an object or an array.
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not an object or an array
 */
export const canJSONBeSerialized = (value: unknown): void => {
  if (!isObjectValid(value, true) && !isArrayValid(value, true)) {
    throw new Exception(
      `The JSON value must be an object or an array in order to be stringified. Received: ${String(value)}`,
      { code: ERRORS.UNSUPPORTED_DATA_TYPE },
    );
  }
};

/**
 * Validates the result of a JSON serialization operation.
 * @param value The original value that was attempted to be serialized.
 * @param result The result of the JSON.stringify operation.
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if the result of JSON.stringify is not a valid string
 */
export const validateJSONSerializationResult = (value: unknown, result: unknown): void => {
  if (typeof result !== 'string' || !result.length) {
    throw new Exception(
      `Stringifying the JSON value '${String(value)}' produced an invalid result: ${String(result)}.`,
      { code: ERRORS.UNABLE_TO_SERIALIZE_JSON },
    );
  }
};

/**
 * Checks if a JSON value can be deserialized (JSON.parse).
 * @param value The value to check for JSON deserialization.
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not a non-empty string
 */
export const canJSONBeDeserialized = (value: string): void => {
  if (typeof value !== 'string' || !value.length) {
    throw new Exception(
      `The JSON value must be a non-empty string in order to be parsed. Received: ${value}`,
      { code: ERRORS.UNSUPPORTED_DATA_TYPE },
    );
  }
};

/**
 * Validates the result of a JSON deserialization operation (JSON.parse).
 * @param value The original value that was attempted to be deserialized.
 * @param result The result of the JSON.parse operation.
 * @throws
 * - UNABLE_TO_DESERIALIZE_JSON: if the result of JSON.parse is not a valid object or array
 */
export const validateJSONDeserializationResult = (value: string, result: unknown): void => {
  if (!isObjectValid(result, true) && !isArrayValid(result, true)) {
    throw new Exception(
      `Parsing the JSON value '${value}' produced an invalid result: ${String(result)}.`,
      { code: ERRORS.UNABLE_TO_DESERIALIZE_JSON },
    );
  }
};
