import { v4 as uuidv4, v7 as uuidv7 } from 'uuid';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IUuidVersion } from '../shared/types.js';
import type { IDateValue } from '../transformers/index.js';
import { ONE_DAY_IN_MILLISECONDS, toDate, toUtcDate } from '../transformers/index.js';

import { createUint32Source, drawFloat, drawUniformIndex, drawUniformInteger } from './random.js';
import type { IUtcDateRange } from './types.js';

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

// a UTC calendar date, as `YYYY-MM-DD`
const UTC_DATE = /^\d{4}-\d{2}-\d{2}$/;

// the first millisecond of the year 0000, the earliest date a `YYYY-MM-DD` range can start on
const YEAR_ZERO_START = Date.parse('0000-01-01T00:00:00.000Z');

/**
 * Reads the start of a UTC calendar date, checking that it's a real date, such that `2026-02-30`
 * isn't one.
 * @param value The date, as `YYYY-MM-DD`.
 * @returns The date's first millisecond, or `undefined` when it isn't a real date.
 */
const readUtcDate = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || !UTC_DATE.test(value)) {
    return undefined;
  }
  const start = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(start) && new Date(start).toISOString().startsWith(value)
    ? start
    : undefined;
};

/**
 * Gives the inclusive range of the last `dayCount` UTC days, ending on the UTC date of an instant,
 * such as the 30 days a report covers.
 * @param dayCount The number of days, a positive safe integer; 1 gives a range of one day.
 * @param value? The instant the range ends on: a Date, a millisecond epoch, or a date string.
 * Defaults to now.
 * @returns The first and last UTC dates, as `YYYY-MM-DD`.
 * @example
 * import { getTrailingUtcDateRange } from 'jg-utilities';
 *
 * getTrailingUtcDateRange(7, '2026-10-17T08:30:00.000Z'); // => { fromDate: '2026-10-11', toDate: '2026-10-17' }
 * getTrailingUtcDateRange(30); // the last 30 days, today included
 * @throws
 * - INVALID_DAY_COUNT: The day count must be a positive safe integer whose range starts in the year 0000 or later.
 * - INVALID_DATE: The value is not a valid date in the years 0000 to 9999.
 */
export const getTrailingUtcDateRange = (dayCount: number, value?: IDateValue): IUtcDateRange => {
  const lastDate = toUtcDate(value);
  // a UTC day is always the same number of milliseconds, so this is exact
  const start = Date.parse(`${lastDate}T00:00:00.000Z`) - (dayCount - 1) * ONE_DAY_IN_MILLISECONDS;
  if (!Number.isSafeInteger(dayCount) || dayCount < 1 || !(start >= YEAR_ZERO_START)) {
    throw new Exception(
      'The day count must be a positive safe integer whose range starts in the year 0000 or later.',
      { code: ERRORS.INVALID_DAY_COUNT, data: { dayCount: String(dayCount) } },
    );
  }
  return { fromDate: toUtcDate(start), toDate: lastDate };
};

/**
 * Lists every UTC calendar date in an inclusive range, in ascending order, such as the days of a
 * chart's axis. It gives one entry per day, so bound the range before passing one from a client.
 * @param range The first and last dates, as `YYYY-MM-DD`.
 * @returns The dates, from `fromDate` to `toDate`.
 * @example
 * import { generateUtcDateSequence } from 'jg-utilities';
 *
 * generateUtcDateSequence({ fromDate: '2028-02-28', toDate: '2028-03-01' }); // => ['2028-02-28', '2028-02-29', '2028-03-01']
 * @throws
 * - INVALID_DATE_RANGE: The range must hold two real dates as YYYY-MM-DD, the first no later than the second.
 */
export const generateUtcDateSequence = (range: IUtcDateRange): string[] => {
  // a range from a caller that skips type checking may not be an object
  const fromDate = (range as Partial<IUtcDateRange> | null | undefined)?.fromDate;
  const lastDate = (range as Partial<IUtcDateRange> | null | undefined)?.toDate;
  const start = readUtcDate(fromDate);
  const end = readUtcDate(lastDate);
  if (start === undefined || end === undefined || start > end) {
    throw new Exception(
      'The range must hold two real dates as YYYY-MM-DD, the first no later than the second.',
      {
        code: ERRORS.INVALID_DATE_RANGE,
        data: { fromDate: String(fromDate), toDate: String(lastDate) },
      },
    );
  }
  const dates: string[] = [];
  for (let current = start; current <= end; current += ONE_DAY_IN_MILLISECONDS) {
    dates.push(new Date(current).toISOString().slice(0, 10));
  }
  return dates;
};
