import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type { IBigNumber } from '../shared/types.js';

/**
 * Ensures the number of decimal places is a number from 0 to 100.
 * @param decimalPlaces The number of decimal places.
 * @throws
 * - INVALID_DECIMAL_PLACES: if decimalPlaces is not a number or it is outside of the 0 - 100 range
 */
export const validateDecimalPlaces = (decimalPlaces: number): void => {
  if (typeof decimalPlaces !== 'number' || decimalPlaces < 0 || decimalPlaces > 100) {
    throw new Exception(
      `The decimalPlaces '${String(decimalPlaces)}' must be a number ranging 0 - 100.`,
      ERRORS.INVALID_DECIMAL_PLACES,
    );
  }
};

/**
 * Ensures a sequence of values is an array.
 * @param values The values.
 * @param calculationName The calculation the values are for, used in the message.
 * @throws
 * - INVALID_VALUES_ARRAY: if values is not a valid array
 */
export const validateValuesArray = (values: unknown, calculationName: string): void => {
  if (!Array.isArray(values)) {
    throw new Exception(
      `Cannot run ${calculationName} on an invalid sequence of BigNumber Values. Received: ${String(values)}`,
      ERRORS.INVALID_VALUES_ARRAY,
    );
  }
};

/**
 * Ensures a value is positive, or zero when allowed.
 * @param value The value.
 * @param allowZero Whether zero is accepted.
 * @throws
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the value is not positive
 */
export const validatePositiveValue = (value: IBigNumber, allowZero?: boolean): void => {
  if (allowZero && value.isLessThan(0)) {
    throw new Exception(
      `The value '${value.toString()}' must be greater than or equal to 0.`,
      ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
    );
  } else if (!allowZero && value.isLessThanOrEqualTo(0)) {
    throw new Exception(
      `The value '${value.toString()}' must be greater than 0.`,
      ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
    );
  }
};
