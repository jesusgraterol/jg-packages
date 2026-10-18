import { Exception, isException } from 'jg-exception';

import { BigNumber } from '../shared/constants.js';
import { ERRORS } from '../shared/errors.js';
import type {
  IBigNumber,
  IBigNumberValue,
  IConfig,
  IOutput,
  IPrettifyFormat,
} from '../shared/types.js';
import {
  buildConfig,
  buildFormatConfig,
  buildInvalidValueException,
  convertBigNumberToType,
  roundBigNumber,
} from '../utils/utils.js';

/**
 * Creates a BigNumber from a number, a numeric string, or a BigNumber, which is returned as is.
 * Only finite values are accepted: `NaN` and `±Infinity` are rejected.
 * @param value The value.
 * @returns The BigNumber.
 * @example
 * import { getBigNumber } from 'jg-bignumber';
 *
 * getBigNumber('0.1').plus('0.2').toString(); // => '0.3'
 * @throws
 * - INVALID_VALUE: if the value isn't a finite number or BigNumber throws an error
 */
export const getBigNumber = (value: IBigNumberValue): IBigNumber => {
  let bigNumber: IBigNumber;
  try {
    bigNumber = BigNumber.isBigNumber(value) ? value : BigNumber(value);
  } catch (error) {
    throw buildInvalidValueException(value, error);
  }
  if (!bigNumber.isFinite()) {
    throw buildInvalidValueException(value);
  }
  return bigNumber;
};

/**
 * Rounds a value and returns it as the type the configuration asks for: a number by default, or a
 * string or a BigNumber.
 * @param value The value.
 * @param configuration The decimal places, rounding mode, and output type.
 * @returns The processed value.
 * @example
 * import { processValue } from 'jg-bignumber';
 *
 * processValue(512.155); // => 512.16
 * processValue(512.155, { decimalPlaces: 1, roundingMode: 'ROUND_FLOOR' }); // => 512.1
 * processValue('0.000001', { decimalPlaces: 6, type: 'string' }); // => '0.000001'
 * @throws
 * - INVALID_VALUE: if the value isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 */
export const processValue = <T extends Partial<IConfig>>(
  value: IBigNumberValue,
  configuration?: T,
): IOutput<T> => {
  const config = buildConfig(configuration);
  const bigNumber = roundBigNumber(getBigNumber(value), config.decimalPlaces, config.roundingMode);
  return convertBigNumberToType(bigNumber, config.type) as IOutput<T>;
};

/**
 * Processes a value and formats it for people, with group separators, a prefix, and a suffix.
 * Trailing zeros are dropped, unless `format.minimumDecimalPlaces` keeps them.
 * @param value The value.
 * @param config How the value is processed and formatted.
 * @returns The formatted value.
 * @example
 * import { prettifyValue } from 'jg-bignumber';
 *
 * prettifyValue(1234567.891); // => '1,234,567.89'
 * prettifyValue(1234.5, { format: { prefix: '$' } }); // => '$1,234.5'
 * prettifyValue(1234.5, { format: { prefix: '$', minimumDecimalPlaces: 2 } }); // => '$1,234.50'
 * @throws
 * - INVALID_VALUE: if the value isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_BIGNUMBER_FORMAT: if any of the format properties are invalid, or minimumDecimalPlaces
 * exceeds decimalPlaces
 */
export const prettifyValue = (
  value: IBigNumberValue,
  config: { processing?: Partial<IConfig>; format?: IPrettifyFormat } = {},
): string => {
  try {
    const { decimalPlaces } = buildConfig(config.processing);
    // the value is already rounded to decimalPlaces, so the maximum only checks the minimum
    return processValue(value, {
      ...config.processing,
      type: 'bignumber',
    }).toFormat(
      [config.format?.minimumDecimalPlaces, decimalPlaces],
      buildFormatConfig(config.format),
    );
  } catch (error) {
    if (isException(error)) {
      throw error;
    }
    throw new Exception('The value could not be formatted.', {
      code: ERRORS.INVALID_BIGNUMBER_FORMAT,
      cause: error,
    });
  }
};

/**
 * Checks whether a value is a BigNumber instance, from this package or any other copy of
 * bignumber.js.
 * @param value The value.
 * @returns Whether it's a BigNumber.
 * @example
 * import { getBigNumber, isBigNumber } from 'jg-bignumber';
 *
 * isBigNumber(getBigNumber(1)); // => true
 * isBigNumber(1); // => false
 */
export const isBigNumber = (value: unknown): value is IBigNumber => BigNumber.isBigNumber(value);

/**
 * Checks whether a value is a finite number, numeric string, or BigNumber.
 * @param value The value.
 * @returns Whether it's a finite number.
 * @example
 * import { isNumber } from 'jg-bignumber';
 *
 * isNumber('12.5'); // => true
 * isNumber(Infinity); // => false
 * isNumber('abc'); // => false
 */
export const isNumber = (value: unknown): boolean => {
  try {
    getBigNumber(value as IBigNumberValue);
    return true;
  } catch {
    return false;
  }
};

/**
 * Checks whether a value is a finite integer, in any of the supported types.
 * @param value The value.
 * @returns Whether it's an integer.
 * @example
 * import { isInteger } from 'jg-bignumber';
 *
 * isInteger('12'); // => true
 * isInteger(12.5); // => false
 */
export const isInteger = (value: unknown): boolean => {
  try {
    return getBigNumber(value as IBigNumberValue).isInteger();
  } catch {
    return false;
  }
};

/**
 * Checks whether a value is a finite number with a fractional part, in any of the supported types.
 * @param value The value.
 * @returns Whether it's a float.
 * @example
 * import { isFloat } from 'jg-bignumber';
 *
 * isFloat(12.5); // => true
 * isFloat('12'); // => false
 */
export const isFloat = (value: unknown): boolean => {
  try {
    return !getBigNumber(value as IBigNumberValue).isInteger();
  } catch {
    return false;
  }
};
