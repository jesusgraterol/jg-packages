import { Exception, getErrorCode } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IJsonValue } from '../shared/types.js';
import { isObjectValid } from '../validations/index.js';

import type { IDeterministicJsonOptions } from './types.js';

import {
  canJsonBeDeserialized,
  canJsonBeSerialized,
  validateByteLimit,
  validateJsonDeserializationResult,
  validateJsonSerializationResult,
} from './validations.js';

/**
 * Serializes a JSON object with the JSON.stringify method.
 * @param value The value to be serialized. It should be an object or an array.
 * @returns A string representing the serialized JSON object.
 * @example
 * import { stringifyJson } from 'jg-utilities';
 *
 * stringifyJson({ id: 1, tags: ['a'] }); // => '{"id":1,"tags":["a"]}'
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not an object or an array
 * - UNABLE_TO_SERIALIZE_JSON: if the result of JSON.stringify is not a valid string
 * - UNABLE_TO_SERIALIZE_JSON: if an error is thrown during stringification
 */
export const stringifyJson = <T>(value: T): string => {
  canJsonBeSerialized(value);
  try {
    const result = JSON.stringify(value);
    validateJsonSerializationResult(value, result);
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

// one step of the path from the top-level value to the one being serialized
type IJsonPathStep = string | number;

/**
 * Writes a path, such as `$.items[2].name`, for an error message.
 * @param path The steps from the top-level value.
 * @returns The path.
 */
const formatJsonPath = (path: readonly IJsonPathStep[]): string =>
  path.reduce<string>((formatted, step) => {
    if (typeof step === 'number') {
      return `${formatted}[${step}]`;
    }
    return /^[A-Za-z_$][\w$]*$/.test(step)
      ? `${formatted}.${step}`
      : `${formatted}[${JSON.stringify(step)}]`;
  }, '$');

/**
 * Throws the error for a value strict mode refuses, or that JSON can't hold.
 * @param path The value's path.
 * @param problem What's wrong with it.
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: always
 */
const throwUnserializable = (path: readonly IJsonPathStep[], problem: string): never => {
  throw new Exception(
    `Failed to stringify the JSON value deterministically: the value at ${formatJsonPath(path)} ${problem}.`,
    { code: ERRORS.UNABLE_TO_SERIALIZE_JSON },
  );
};

/**
 * Replaces a value with what JSON.stringify serializes in its place: the result of its toJSON, and
 * the primitive inside a Number, String, or Boolean object.
 * @param value The value.
 * @param key Its key, or its index as a string, which toJSON receives.
 * @returns The value to serialize.
 */
const toJsonInput = (value: unknown, key: string): unknown => {
  const converted =
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toJSON?: unknown }).toJSON === 'function'
      ? (value as { toJSON: (key: string) => unknown }).toJSON(key)
      : value;
  if (converted instanceof Number) {
    return Number(converted);
  }
  if (converted instanceof String || converted instanceof Boolean) {
    return converted.valueOf();
  }
  return converted;
};

/**
 * Serializes one value with sorted keys, or returns undefined for a value JSON leaves out, such as
 * undefined in default mode.
 * @param value The value, after toJsonInput in default mode.
 * @param strict Whether only plain JSON data is accepted.
 * @param ancestors The objects being serialized around it, to detect a cycle.
 * @param path Its path, which the function extends and restores while it descends.
 * @returns The JSON text, or undefined.
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if the value can't be serialized, or strict mode refuses it
 */
const serializeSorted = (
  value: unknown,
  strict: boolean,
  ancestors: Set<object>,
  path: IJsonPathStep[],
): string | undefined => {
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (strict && !Number.isFinite(value)) {
        throwUnserializable(path, `is ${String(value)}, which JSON can't hold`);
      }
      // JSON.stringify writes -0 as 0, and a non-finite number as null
      return JSON.stringify(value);
    case 'bigint':
      return throwUnserializable(path, "is a BigInt, which JSON can't hold");
    case 'undefined':
    case 'function':
    case 'symbol':
      return strict ? throwUnserializable(path, `is ${typeof value}`) : undefined;
  }
  if (value === null) {
    return 'null';
  }
  // after the switch, only objects and arrays are left
  const container = value as object;
  if (ancestors.has(container)) {
    throwUnserializable(path, 'refers back to an object that contains it');
  }
  const isArray = Array.isArray(container);
  if (strict && !isArray) {
    const prototype: unknown = Object.getPrototypeOf(container);
    if (prototype !== Object.prototype && prototype !== null) {
      throwUnserializable(path, 'is not a plain object');
    }
    if (Object.getOwnPropertySymbols(container).length > 0) {
      throwUnserializable(path, 'has a symbol key');
    }
  }
  ancestors.add(container);
  const parts: string[] = [];
  if (isArray) {
    for (let index = 0; index < container.length; index += 1) {
      if (strict && !Object.hasOwn(container, index)) {
        throwUnserializable([...path, index], 'is a hole in the array');
      }
      path.push(index);
      const item: unknown = strict
        ? container[index]
        : toJsonInput(container[index], String(index));
      parts.push(serializeSorted(item, strict, ancestors, path) ?? 'null');
      path.pop();
    }
  } else {
    const record = container as Record<string, unknown>;
    // Array.prototype.sort orders strings by UTF-16 code unit, as RFC 8785 does
    for (const key of Object.keys(record).sort()) {
      path.push(key);
      const item = strict ? record[key] : toJsonInput(record[key], key);
      const serialized = serializeSorted(item, strict, ancestors, path);
      if (serialized !== undefined) {
        parts.push(`${JSON.stringify(key)}:${serialized}`);
      }
      path.pop();
    }
  }
  ancestors.delete(container);
  return isArray ? `[${parts.join(',')}]` : `{${parts.join(',')}}`;
};

/**
 * Stringifies an object or an array with every object's keys in the order RFC 8785 sets, by UTF-16
 * code unit, so equal data always gives the same text, such as for a cache key, a digest, or a
 * signature. The text is built directly, so integer-like keys sort with the others instead of
 * first. Default mode writes what JSON.stringify writes: it calls toJSON, leaves out properties that
 * are undefined, functions, or symbols, and writes null for them in arrays, for holes, and for NaN
 * and ±Infinity. Strict mode accepts only plain JSON data, and throws for undefined anywhere,
 * NaN and ±Infinity, BigInts, symbols, functions, objects that aren't plain, symbol keys, and holes,
 * naming the value's path; -0 is written as 0.
 * @param value The value to be serialized. It should be an object or an array.
 * @param options? `strict`, to accept only plain JSON data.
 * @returns A string representing the serialized JSON object with sorted keys.
 * @example
 * import { stringifyJsonDeterministically } from 'jg-utilities';
 *
 * stringifyJsonDeterministically({ b: 1, a: { d: 2, c: 3 } }); // => '{"a":{"c":3,"d":2},"b":1}'
 * stringifyJsonDeterministically({ 10: 'b', 9: 'a' }); // => '{"10":"b","9":"a"}'
 * stringifyJsonDeterministically({ when: new Date(0), skip: undefined }); // => '{"when":"1970-01-01T00:00:00.000Z"}'
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not an object or an array
 * - UNABLE_TO_SERIALIZE_JSON: if the value holds a cycle or a BigInt, or a value strict mode refuses
 * - UNABLE_TO_SERIALIZE_JSON: if an error is thrown during stringification
 */
export const stringifyJsonDeterministically = <T>(
  value: T,
  { strict = false }: IDeterministicJsonOptions = {},
): string => {
  canJsonBeSerialized(value);
  try {
    const serialized = serializeSorted(
      strict ? value : toJsonInput(value, ''),
      strict,
      new Set(),
      [],
    );
    validateJsonSerializationResult(value, serialized);
    return serialized as string;
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

// how deeply measureJsonBytes descends into nested objects and arrays
const MAX_MEASURED_JSON_DEPTH = 64;

// the escapes JSON writes as two characters, such as \n, by character code
const SHORT_JSON_ESCAPES = new Set([0x08, 0x09, 0x0a, 0x0c, 0x0d, 0x22, 0x5c]);

/**
 * Counts the UTF-8 bytes JSON.stringify writes for a string, quotes and escapes included, stopping
 * once the count passes a limit.
 * @param text The string.
 * @param maxBytes The limit.
 * @returns The exact count, or a number above the limit.
 */
const measureJsonString = (text: string, maxBytes: number): number => {
  let bytes = 2;
  for (let index = 0; index < text.length && bytes <= maxBytes; index += 1) {
    const code = text.charCodeAt(index);
    if (SHORT_JSON_ESCAPES.has(code)) {
      bytes += 2;
    } else if (code < 0x20) {
      bytes += 6;
    } else if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      (text.charCodeAt(index + 1) & 0xfc00) === 0xdc00
    ) {
      bytes += 4;
      index += 1;
    } else {
      // a lone surrogate is written as a \uXXXX escape
      bytes += code >= 0xd800 && code <= 0xdfff ? 6 : 3;
    }
  }
  return bytes;
};

/**
 * Counts the UTF-8 bytes JSON.stringify writes for one value, or returns undefined for a value it
 * leaves out, stopping once the count passes a limit.
 * @param value The value, after toJsonInput.
 * @param maxBytes The limit.
 * @param ancestors The objects being measured around it, to detect a cycle.
 * @param depth How deeply it's nested.
 * @returns The exact count, a number above the limit, or undefined.
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if the value holds a cycle or a BigInt, or is nested too deeply
 */
const measureJsonValue = (
  value: unknown,
  maxBytes: number,
  ancestors: Set<object>,
  depth: number,
): number | undefined => {
  if (depth > MAX_MEASURED_JSON_DEPTH) {
    throw new Exception(`The value is nested more than ${MAX_MEASURED_JSON_DEPTH} levels deep.`, {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
    });
  }
  switch (typeof value) {
    case 'string':
      return measureJsonString(value, maxBytes);
    case 'number':
      return Number.isFinite(value) ? String(value).length : 4;
    case 'boolean':
      return value ? 4 : 5;
    case 'bigint':
      throw new Exception("The value holds a BigInt, which JSON can't hold.", {
        code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
      });
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (value === null) {
    return 4;
  }
  // after the switch, only objects and arrays are left
  const container = value as object;
  if (ancestors.has(container)) {
    throw new Exception('The value refers back to an object that contains it.', {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
    });
  }
  ancestors.add(container);
  let bytes = 2;
  let count = 0;
  if (Array.isArray(container)) {
    for (let index = 0; index < container.length && bytes <= maxBytes; index += 1) {
      const item = toJsonInput(container[index], String(index));
      bytes +=
        (count === 0 ? 0 : 1) + (measureJsonValue(item, maxBytes, ancestors, depth + 1) ?? 4);
      count += 1;
    }
  } else {
    const record = container as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (bytes > maxBytes) {
        break;
      }
      const item = measureJsonValue(toJsonInput(record[key], key), maxBytes, ancestors, depth + 1);
      if (item !== undefined) {
        bytes += (count === 0 ? 0 : 1) + measureJsonString(key, maxBytes) + 1 + item;
        count += 1;
      }
    }
  }
  ancestors.delete(container);
  return bytes;
};

/**
 * Measures how many UTF-8 bytes `JSON.stringify(value)` would write, without writing it, such as to
 * refuse a message over a size limit before serializing it. It stops once the count passes
 * `maxBytes`, so an oversized value costs little. It takes primitives as well as objects and
 * arrays, calls toJSON as JSON.stringify does, and descends at most 64 levels.
 * @param value The value.
 * @param maxBytes The limit, a non-negative safe integer.
 * @returns The exact size when it's at most `maxBytes`, otherwise a number above it.
 * @example
 * import { measureJsonBytes } from 'jg-utilities';
 *
 * measureJsonBytes({ name: 'café' }, 1024); // => 16
 * measureJsonBytes('x'.repeat(10_000), 100) > 100; // => true
 * @throws
 * - INVALID_BYTE_LIMIT: The byte limit must be a non-negative safe integer.
 * - UNABLE_TO_SERIALIZE_JSON: if JSON.stringify would write nothing, or throw, such as for a cycle
 * or a BigInt, or the value is nested more than 64 levels deep
 */
export const measureJsonBytes = (value: unknown, maxBytes: number): number => {
  validateByteLimit(maxBytes);
  let bytes: number | undefined;
  try {
    bytes = measureJsonValue(toJsonInput(value, ''), maxBytes, new Set(), 0);
  } catch (error) {
    if (getErrorCode(error) === ERRORS.UNABLE_TO_SERIALIZE_JSON) {
      throw error;
    }
    // an error from the value's own code, such as a toJSON or a getter
    throw new Exception('Failed to measure the JSON value.', {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
      cause: error,
    });
  }
  if (bytes === undefined) {
    throw new Exception(`JSON.stringify writes nothing for ${typeof value} values.`, {
      code: ERRORS.UNABLE_TO_SERIALIZE_JSON,
    });
  }
  return bytes;
};

/**
 * Deserializes a JSON string with the JSON.parse method.
 * @param value The JSON string to be deserialized.
 * @returns The deserialized object or array.
 * @example
 * import { parseJson } from 'jg-utilities';
 *
 * const user = parseJson<{ id: number }>('{"id":1}'); // { id: 1 }
 * @throws
 * - UNSUPPORTED_DATA_TYPE: if the provided value is not a non-empty string
 * - UNABLE_TO_DESERIALIZE_JSON: if the result of JSON.parse is not a valid object or array
 * - UNABLE_TO_DESERIALIZE_JSON: if an error is thrown during parsing
 */
export const parseJson = <T>(value: string): T => {
  canJsonBeDeserialized(value);
  try {
    const result: unknown = JSON.parse(value);
    validateJsonDeserializationResult(value, result);
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
 * import { pruneJson } from 'jg-utilities';
 *
 * pruneJson({ a: 1, b: null, c: {}, d: [], e: { f: [] } }); // => { a: 1 }
 */
export const pruneJson = <T extends IJsonValue>(value: T): T | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value
      .map((item) => pruneJson(item))
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
    const cleanedObject: Record<string, IJsonValue> = {};

    Object.entries(value).forEach(([key, item]) => {
      if (item === undefined) return;
      const cleanedItem = pruneJson(item);

      // pruneJson returns null for anything empty, so what's left has content
      if (cleanedItem === null || cleanedItem === undefined) return;

      cleanedObject[key] = cleanedItem;
    });

    // if after cleaning it has no keys, return null
    return Object.keys(cleanedObject).length > 0 ? (cleanedObject as T) : null;
  }

  return value;
};
