import { Exception, extractMessage } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IDateValue } from '../transformers/index.js';
import { toDate } from '../transformers/index.js';

import type { ISortDirection } from './types.js';

/**
 * Orders two string values based on a sorting direction.
 * @param firstValue The first string value to compare.
 * @param secondValue The second string value to compare.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order.
 */
const __sortStringValues = (
  firstValue: string,
  secondValue: string,
  direction: ISortDirection,
): number => {
  const normalizedFirstValue = firstValue.toLocaleLowerCase();
  const normalizedSecondValue = secondValue.toLocaleLowerCase();
  if (normalizedFirstValue > normalizedSecondValue) {
    return direction === 'asc' ? 1 : -1;
  }
  if (normalizedSecondValue > normalizedFirstValue) {
    return direction === 'asc' ? -1 : 1;
  }
  return 0;
};

/**
 * Orders two number values based on a sorting direction.
 * @param firstValue The first number value to compare.
 * @param secondValue The second number value to compare.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order.
 */
const __sortNumberValues = (
  firstValue: number,
  secondValue: number,
  direction: ISortDirection,
): number => (direction === 'asc' ? firstValue - secondValue : secondValue - firstValue);

/**
 * Orders two bigint values based on a sorting direction.
 * @param firstValue The first bigint value to compare.
 * @param secondValue The second bigint value to compare.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order.
 */
const __sortBigIntValues = (
  firstValue: bigint,
  secondValue: bigint,
  direction: ISortDirection,
): number => {
  if (firstValue === secondValue) return 0;
  return (direction === 'asc') === firstValue < secondValue ? -1 : 1;
};

/**
 * Sorts a list of primitive values based on their type and a sort direction.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order based on the primitive type.
 * @example
 * [3, 1, 2].sort(sortPrimitives('asc')); // [1, 2, 3]
 * ['b', 'c', 'a'].sort(sortPrimitives('desc')); // ['c', 'b', 'a']
 * @throws
 * - MIXED_OR_UNSUPPORTED_DATA_TYPES: if the values are mixed or are different to string | number | bigint
 */
export const sortPrimitives =
  (direction: ISortDirection) =>
  <T extends string | number | bigint>(firstValue: T, secondValue: T): number => {
    if (typeof firstValue === 'string' && typeof secondValue === 'string') {
      return __sortStringValues(firstValue, secondValue, direction);
    }
    if (typeof firstValue === 'number' && typeof secondValue === 'number') {
      return __sortNumberValues(firstValue, secondValue, direction);
    }
    if (typeof firstValue === 'bigint' && typeof secondValue === 'bigint') {
      return __sortBigIntValues(firstValue, secondValue, direction);
    }
    throw new Exception(
      `Unable to sort list of primitive values as they can only be string | number | bigint and must not be mixed. Received: ${typeof firstValue}, ${typeof secondValue}`,
      { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
    );
  };

/**
 * Sorts a list of record values by key based on their type and a sort direction.
 * @param key The key of the record to sort by.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order based on the primitive type.
 * @example
 * [{ age: 40 }, { age: 25 }].sort(sortRecords('age', 'asc')); // [{ age: 25 }, { age: 40 }]
 * @throws
 * - MIXED_OR_UNSUPPORTED_DATA_TYPES: if the values are mixed or are different to string | number | bigint
 */
export const sortRecords =
  (key: string, direction: ISortDirection) =>
  <T extends object>(firstRecord: T, secondRecord: T): number => {
    const firstValue = (firstRecord as Record<string, unknown>)[key];
    const secondValue = (secondRecord as Record<string, unknown>)[key];
    if (typeof firstValue === 'string' && typeof secondValue === 'string') {
      return __sortStringValues(firstValue, secondValue, direction);
    }
    if (typeof firstValue === 'number' && typeof secondValue === 'number') {
      return __sortNumberValues(firstValue, secondValue, direction);
    }
    if (typeof firstValue === 'bigint' && typeof secondValue === 'bigint') {
      return __sortBigIntValues(firstValue, secondValue, direction);
    }
    throw new Exception(
      `Unable to sort list of record values as they can only be string | number | bigint and must not be mixed. Received: ${typeof firstValue}, ${typeof secondValue}`,
      { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
    );
  };

/**
 * Sorts a list of record values by key, treating stringified bigints as actual bigints, based on a
 * sort direction.
 * @param key The key of the record to sort by.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order based on the primitive type.
 * @example
 * [{ amount: '900000000000000000001' }, { amount: '5' }].sort(sortRecordsWithBigIntString('amount', 'asc')); // [{ amount: '5' }, { amount: '900000000000000000001' }]
 * @throws
 * - MIXED_OR_UNSUPPORTED_DATA_TYPES: if the values are mixed or are different to string | number | bigint
 */
export const sortRecordsWithBigIntString =
  <T extends Record<string, unknown>>(key: keyof T, direction: ISortDirection) =>
  (firstRecord: T, secondRecord: T): number => {
    try {
      const firstValue = firstRecord[key];
      const secondValue = secondRecord[key];

      if (typeof firstValue === 'string' && typeof secondValue === 'string') {
        const firstBigInt = BigInt(firstValue);
        const secondBigInt = BigInt(secondValue);
        return __sortBigIntValues(firstBigInt, secondBigInt, direction);
      }

      throw new Exception(
        `Unable to sort list of record values as they can only be stringified bigints. Received: ${typeof firstValue}, ${typeof secondValue}`,
        { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
      );
    } catch (error) {
      if (error instanceof Exception && error.code === ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES) {
        throw error;
      }
      throw new Exception(
        `Failed to sort list of record values as they can only be stringified bigints: ${extractMessage(error)}`,
        { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
      );
    }
  };

/**
 * Sorts a list of record values by key, treating date values as actual Date objects, based on a
 * sort direction.
 * @param key The key of the record to sort by.
 * @param direction The direction to sort the values.
 * @returns A number indicating the sort order based on the date values.
 * @example
 * [{ at: '2026-10-17' }, { at: '2025-01-01' }].sort(sortRecordsWithDateValue('at', 'asc')); // [{ at: '2025-01-01' }, { at: '2026-10-17' }]
 * @throws
 * - MIXED_OR_UNSUPPORTED_DATA_TYPES: if either record has a missing, null, or invalid date value
 */
export const sortRecordsWithDateValue =
  <T extends Record<string, unknown>>(key: keyof T, direction: ISortDirection) =>
  (firstRecord: T, secondRecord: T): number => {
    try {
      const firstValue = firstRecord[key];
      const secondValue = secondRecord[key];

      if (
        firstValue === null ||
        firstValue === undefined ||
        secondValue === null ||
        secondValue === undefined
      ) {
        throw new Exception(
          'Unable to sort list of record values as they can only be valid date values.',
          { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
        );
      }

      const firstDate = toDate(firstValue as IDateValue);
      const secondDate = toDate(secondValue as IDateValue);
      if (Number.isNaN(firstDate.getTime()) || Number.isNaN(secondDate.getTime())) {
        throw new Exception(
          'Unable to sort list of record values as they can only be valid date values.',
          { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
        );
      }

      return __sortNumberValues(firstDate.getTime(), secondDate.getTime(), direction);
    } catch (error) {
      if (error instanceof Exception && error.code === ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES) {
        throw error;
      }
      throw new Exception(
        `Failed to sort list of record values as they can only be valid date values: ${extractMessage(error)}`,
        { code: ERRORS.MIXED_OR_UNSUPPORTED_DATA_TYPES },
      );
    }
  };
