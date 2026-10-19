import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

// a plain decimal: an optional sign, then digits with an optional fraction, or only a fraction
const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

// an integer: an optional sign, then digits
const INTEGER = /^[+-]?\d+$/;

// the basis points in a whole: 100 are 1%, and 10,000 are 100%
const BASIS_POINTS_IN_WHOLE = 10_000n;

/**
 * Ensures the number of decimals of a scaled integer is a whole number from 0 to 100.
 * @param decimals The number of decimals.
 * @throws
 * - INVALID_DECIMAL_PLACES: if decimals isn't an integer from 0 to 100
 */
const validateDecimals = (decimals: number): void => {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 100) {
    throw new Exception('The number of decimals must be an integer from 0 to 100.', {
      code: ERRORS.INVALID_DECIMAL_PLACES,
    });
  }
};

/**
 * Converts an amount, such as dollars, to an integer count of its smallest unit, such as
 * microcents with 8 decimals, so it can be stored and added up exactly, as in a PostgreSQL BIGINT.
 * It takes a number or a plain decimal string, with surrounding spaces and a leading `+` allowed,
 * and never rounds: scientific notation, including a number JavaScript writes that way, such as
 * `0.00000001`, hex, malformed values, and digits beyond `decimals` other than trailing zeros are
 * rejected. Only the text is read, so `0.1 + 0.2`, which is `0.30000000000000004`, fails rather
 * than becoming a slightly wrong amount.
 * @param value The amount.
 * @param decimals How many decimals the smallest unit has, such as 8 for microcents.
 * @returns The amount in the smallest unit.
 * @example
 * import { toScaledInteger } from 'jg-bignumber';
 *
 * toScaledInteger('1.23', 8); // => 123000000n
 * toScaledInteger(' +0.00000001 ', 8); // => 1n
 * toScaledInteger(-12.5, 2); // => -1250n
 * @throws
 * - INVALID_VALUE: if the value isn't a plain decimal, or has more decimals than `decimals`
 * - INVALID_DECIMAL_PLACES: if decimals isn't an integer from 0 to 100
 */
export const toScaledInteger = (value: number | string, decimals: number): bigint => {
  validateDecimals(decimals);
  const text =
    typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const [, sign = '', whole = '', fraction = ''] = DECIMAL.exec(text) ?? [];
  if ((whole === '' && fraction === '') || /[^0]/.test(fraction.slice(decimals))) {
    throw new Exception(
      `The value must be a plain decimal number with at most ${decimals} decimals.`,
      { code: ERRORS.INVALID_VALUE },
    );
  }
  const scaled =
    BigInt(whole || '0') * 10n ** BigInt(decimals) +
    BigInt(fraction.slice(0, decimals).padEnd(decimals, '0') || '0');
  return sign === '-' ? -scaled : scaled;
};

/**
 * Converts an integer count of an amount's smallest unit, such as microcents, back to the amount
 * as an exact decimal string, with all `decimals` digits and no symbol, separators, or rounding.
 * Pass it to `prettifyValue` to show it to people.
 * @param value The amount in the smallest unit, as a bigint or an integer string, such as a
 * PostgreSQL BIGINT. A string may have surrounding spaces and a sign.
 * @param decimals How many decimals the smallest unit has, such as 8 for microcents.
 * @returns The amount.
 * @example
 * import { fromScaledInteger } from 'jg-bignumber';
 *
 * fromScaledInteger(123000000n, 8); // => '1.23000000'
 * fromScaledInteger('-1', 8); // => '-0.00000001'
 * fromScaledInteger(1250n, 0); // => '1250'
 * @throws
 * - INVALID_VALUE: if the value isn't a bigint or an integer string
 * - INVALID_DECIMAL_PLACES: if decimals isn't an integer from 0 to 100
 */
export const fromScaledInteger = (value: bigint | string, decimals: number): string => {
  validateDecimals(decimals);
  const text = typeof value === 'string' ? value.trim() : value;
  if (typeof text !== 'bigint' && !(typeof text === 'string' && INTEGER.test(text))) {
    throw new Exception('The value must be a bigint or an integer string.', {
      code: ERRORS.INVALID_VALUE,
    });
  }
  const integer = BigInt(text);
  const digits = (integer < 0n ? -integer : integer).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  const fraction = digits.slice(digits.length - decimals);
  return `${integer < 0n ? '-' : ''}${whole}${decimals > 0 ? `.${fraction}` : ''}`;
};

/**
 * Applies a rate in basis points to an integer count of an amount's smallest unit, such as a 5%
 * commission on a payment in microcents, rounding down to a whole unit, so the result never
 * exceeds what the rate gives. 100 basis points are 1%, and 10,000 are 100%.
 * @param value The amount in the smallest unit, 0 or more.
 * @param basisPoints The rate, a non-negative safe integer; it may exceed 10,000 for more than
 * 100%.
 * @returns `value × basisPoints / 10,000`, rounded down.
 * @example
 * import { applyBasisPoints } from 'jg-bignumber';
 *
 * applyBasisPoints(100_000_000n, 500); // => 5000000n
 * applyBasisPoints(123_000_000n, 1500); // => 18450000n
 * applyBasisPoints(10_001n, 1); // => 1n
 * @throws
 * - INVALID_VALUE: The value must be a bigint.
 * - NEGATIVE_VALUE_NOT_ALLOWED: The value must be greater than or equal to 0.
 * - INVALID_VALUE: The basis points must be a non-negative safe integer.
 */
export const applyBasisPoints = (value: bigint, basisPoints: number): bigint => {
  if (typeof value !== 'bigint') {
    throw new Exception('The value must be a bigint.', { code: ERRORS.INVALID_VALUE });
  }
  if (value < 0n) {
    throw new Exception('The value must be greater than or equal to 0.', {
      code: ERRORS.NEGATIVE_VALUE_NOT_ALLOWED,
    });
  }
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new Exception('The basis points must be a non-negative safe integer.', {
      code: ERRORS.INVALID_VALUE,
    });
  }
  // bigint division truncates, which rounds a non-negative product down
  return (value * BigInt(basisPoints)) / BASIS_POINTS_IN_WHOLE;
};
