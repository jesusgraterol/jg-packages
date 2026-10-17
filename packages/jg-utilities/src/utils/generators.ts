import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';

import type { IUuidVersion } from '../shared/types.js';
import type { IDateValue } from '../transformers/index.js';
import { toDate } from '../transformers/index.js';

import { createUint32Source, drawFloat, drawUniformIndex, drawUniformInteger } from './random.js';

/**
 * Generates a UUID based on a version.
 * @param version The version of the UUID to be generated.
 * @returns A UUID string of the specified version.
 * @example
 * import { generateUuid } from 'jg-utilities';
 *
 * generateUuid(4); // such as '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'
 * generateUuid(7); // time-ordered, so later IDs sort after earlier ones
 */
export const generateUuid = (version: IUuidVersion): string => {
  if (version === 7) {
    return uuidv7();
  }
  return uuidv4();
};

/**
 * Generates a string of characters picked at random from a set. Each character is drawn with
 * `crypto.getRandomValues` and rejection sampling, so every character in the set is equally likely
 * and the result is fit for secrets such as passwords.
 * @param length The length of the string.
 * @param characters The characters to pick from. Defaults to ASCII letters and digits.
 * @returns The random string, or an empty string when the length or the set is empty.
 * @example
 * import { generateRandomString } from 'jg-utilities';
 *
 * generateRandomString(12); // such as 'aZ3kPq9TbW0x'
 * generateRandomString(6, '0123456789'); // such as '402913'
 */
export const generateRandomString = (
  length: number,
  characters: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string => {
  if (characters.length === 0 || !(length > 0)) {
    return '';
  }
  const nextUint32 = createUint32Source(length);
  let result = '';
  for (let counter = 0; counter < length; counter += 1) {
    result += characters.charAt(drawUniformIndex(characters.length, nextUint32));
  }
  return result;
};

/**
 * Generates a random decimal in a range, with 53 bits of randomness from `crypto.getRandomValues`.
 * @param min The lowest value, included.
 * @param max The highest value, excluded.
 * @returns A random number greater than or equal to `min` and less than `max`.
 * @example
 * import { generateRandomFloat } from 'jg-utilities';
 *
 * generateRandomFloat(0, 1); // 0.7312...
 */
export const generateRandomFloat = (min: number, max: number): number =>
  drawFloat(createUint32Source(2)) * (max - min) + min;

/**
 * Generates a random integer in an inclusive range. Each integer is equally likely: values come from
 * `crypto.getRandomValues` with rejection sampling.
 * @param min The lowest value, included.
 * @param max The highest value, included.
 * @returns A random integer from `min` to `max`.
 * @example
 * import { generateRandomInteger } from 'jg-utilities';
 *
 * generateRandomInteger(1, 6); // such as 4
 */
export const generateRandomInteger = (min: number, max: number): number =>
  drawUniformInteger(max - min + 1, createUint32Source(2)) + min;

/**
 * Generates a sequence of numbers within a range based on a number of steps.
 * @param start The starting value of the sequence.
 * @param stop The ending value of the sequence.
 * @param step? The step value to increment by. Defaults to 1.
 * @returns An array of numbers representing the sequence.
 * @example
 * import { generateSequence } from 'jg-utilities';
 *
 * generateSequence(1, 5); // => [1, 2, 3, 4, 5]
 * generateSequence(0, 10, 5); // => [0, 5, 10]
 */
export const generateSequence = (start: number, stop: number, step: number = 1): number[] =>
  Array.from({ length: (stop - start) / step + 1 }, (_, index) => start + index * step);

/**
 * Generates a date ID string in the format "YYYY_MM_DD".
 * @param value The date value to generate the ID from. Defaults to the current date if not provided.
 * @returns The generated date ID string.
 * @example
 * import { generateDateId } from 'jg-utilities';
 *
 * generateDateId(new Date(2026, 9, 17)); // => '2026_10_17'
 * generateDateId(); // today's ID
 */
export const generateDateId = (value?: IDateValue): string => {
  const date = toDate(value ?? new Date());
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}_${month}_${day}`;
};
