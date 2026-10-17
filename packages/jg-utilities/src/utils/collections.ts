import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { stringifyJSONDeterministically } from '../transformers/index.js';
import { isIntegerValid } from '../validations/index.js';

import { createUint32Source, drawUniformIndex } from './random.js';
import { canArrayBeShuffled, validateObjectAndKeys } from './validations.js';

/**
 * Creates a shallow copy of the input array and shuffles it with the Fisher-Yates algorithm, drawing
 * each position with `crypto.getRandomValues`, so every order is equally likely.
 * @param input The array to be shuffled.
 * @returns A new array with the values of the input array in a random order.
 * @example
 * import { shuffleArray } from 'jg-utilities';
 *
 * shuffleArray([1, 2, 3, 4]); // a new array, such as [3, 1, 4, 2]
 * @throws
 * - INVALID_OR_EMPTY_ARRAY: if the input is not array or it is empty
 */
export const shuffleArray = <T>(input: Array<T>): Array<T> => {
  canArrayBeShuffled(input);
  const shuffledItems = input.slice();
  const nextUint32 = createUint32Source(shuffledItems.length - 1);
  for (let currentIndex = shuffledItems.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomIndex = drawUniformIndex(currentIndex + 1, nextUint32);
    const currentItem = shuffledItems[currentIndex] as T;
    shuffledItems[currentIndex] = shuffledItems[randomIndex] as T;
    shuffledItems[randomIndex] = currentItem;
  }
  return shuffledItems;
};

/**
 * Splits an array into smaller arrays (batches) of a given size.
 * @param items The array to be split into batches.
 * @param batchSize The size of each batch.
 * @returns An array of arrays, where each inner array is a batch of the specified size.
 * @example
 * import { splitArrayIntoBatches } from 'jg-utilities';
 *
 * splitArrayIntoBatches([1, 2, 3, 4, 5], 2); // => [[1, 2], [3, 4], [5]]
 * @throws
 * - INVALID_BATCH_SIZE: if the batch size is not a valid integer greater than 0
 */
export const splitArrayIntoBatches = <T>(items: T[], batchSize: number): Array<T[]> => {
  // return an empty array if there are no items
  if (!items.length) {
    return [];
  }

  // ensure the batch size is a valid integer greater than zero
  if (!isIntegerValid(batchSize, 1)) {
    throw new Exception(
      `In order to split an array into batches, the batch size must be an integer greater than 0. Received: ${String(batchSize)}`,
      { code: ERRORS.INVALID_BATCH_SIZE },
    );
  }

  // split the items into batches
  const batches: Array<T[]> = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += batchSize) {
    batches.push(items.slice(itemIndex, itemIndex + batchSize));
  }
  return batches;
};

/**
 * Picks a list of properties from an object and returns a new object (shallow) with the provided
 * keys.
 * @param input The object from which to pick properties.
 * @param propKeys The keys of the properties to pick.
 * @returns A new object containing only the picked properties.
 * @example
 * import { pickProps } from 'jg-utilities';
 *
 * pickProps({ id: 1, name: 'Ada', email: 'ada@example.com' }, ['id', 'name']); // => { id: 1, name: 'Ada' }
 * @throws
 * - INVALID_OR_EMPTY_OBJECT: if the input is not a valid object or it is empty
 * - INVALID_OR_EMPTY_ARRAY: if the keys to be picked are not a valid array or it is empty
 */
export const pickProps = <T extends object, K extends keyof T>(
  input: T,
  propKeys: K[],
): Pick<T, K> => {
  validateObjectAndKeys(input, propKeys);
  return Object.fromEntries(propKeys.map((key) => [key, input[key]])) as Pick<T, K>;
};

/**
 * Omits a list of properties from an object and returns a new object (shallow) with only those
 * keys that weren't omitted
 * @param input The object from which to omit properties.
 * @param propKeys The keys of the properties to omit.
 * @returns A new object containing only the properties that were not omitted.
 * @example
 * import { omitProps } from 'jg-utilities';
 *
 * omitProps({ id: 1, name: 'Ada', email: 'ada@example.com' }, ['email']); // => { id: 1, name: 'Ada' }
 * @throws
 * - INVALID_OR_EMPTY_OBJECT: if the input is not a valid object or it is empty
 * - INVALID_OR_EMPTY_ARRAY: if the keys to be omitted are not a valid array or it is empty
 */
export const omitProps = <T extends object, K extends keyof T>(
  input: T,
  propKeys: K[],
): Omit<T, K> => {
  validateObjectAndKeys(input, propKeys);
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => !propKeys.includes(key as K)),
  ) as Omit<T, K>;
};

/**
 * Compares two values. Primitives, `null`, and `undefined` are compared with `Object.is`, so
 * `NaN` equals `NaN` and `0` doesn't equal `-0`. Two objects or arrays are compared deeply,
 * ignoring key order, through their deterministic JSON. An object never equals a primitive.
 * @param firstValue The first value.
 * @param secondValue The second value.
 * @returns Whether the values are equal.
 * @example
 * import { isEqual } from 'jg-utilities';
 *
 * isEqual({ a: 1, b: [2] }, { b: [2], a: 1 }); // => true
 * isEqual('a', 'a'); // => true
 * isEqual({}, null); // => false
 * @throws
 * - UNABLE_TO_SERIALIZE_JSON: if either object contains data that cannot be serialized
 */
export const isEqual = (firstValue: unknown, secondValue: unknown): boolean => {
  const isFirstObject = typeof firstValue === 'object' && firstValue !== null;
  const isSecondObject = typeof secondValue === 'object' && secondValue !== null;
  if (!isFirstObject || !isSecondObject) {
    return Object.is(firstValue, secondValue);
  }
  return stringifyJSONDeterministically(firstValue) === stringifyJSONDeterministically(secondValue);
};

/**
 * Applies non-nullish overrides to a defaults object and returns a new shallow object.
 * @param defaults The object containing the default properties and values.
 * @param overrides The values that should replace matching defaults when they are not nullish.
 * @returns A new object containing the default keys and resolved values.
 * @example
 * import { applyDefaults } from 'jg-utilities';
 *
 * applyDefaults({ retries: 3, timeout: 15 }, { retries: 5, timeout: null }); // => { retries: 5, timeout: 15 }
 */
export const applyDefaults = <T extends Record<string, unknown>>(
  defaults: T,
  overrides: { [Key in keyof T]?: T[Key] | null | undefined },
): T =>
  Object.entries(defaults).reduce(
    (resolvedValues, [key, defaultValue]) => ({
      ...resolvedValues,
      [key]: overrides[key] ?? defaultValue,
    }),
    {} as T,
  );
