import { Exception, extractMessage } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import type {
  IBigNumber,
  IBigNumberFormat,
  IBigNumberRoundingMode,
  IBigNumberRoundingModeName,
  IBigNumberToType,
  IConfig,
  IType,
} from '../shared/types.js';
import { validateDecimalPlaces } from '../validations/validations.js';

// the numeric rounding mode bignumber.js uses for each mode name
const ROUNDING_MODES: Record<IBigNumberRoundingModeName, IBigNumberRoundingMode> = {
  ROUND_UP: 0,
  ROUND_DOWN: 1,
  ROUND_CEIL: 2,
  ROUND_FLOOR: 3,
  ROUND_HALF_UP: 4,
  ROUND_HALF_DOWN: 5,
  ROUND_HALF_EVEN: 6,
  ROUND_HALF_CEIL: 7,
  ROUND_HALF_FLOOR: 8,
};

/**
 * Describes a value for an error message, without failing on values that can't be stringified,
 * such as symbols' descriptions or objects without a prototype.
 * @param value The value.
 * @returns The description, or `UNKNOWN`.
 */
const describeValue = (value: unknown): string => {
  try {
    return String(value);
  } catch {
    return 'UNKNOWN';
  }
};

/**
 * Builds the exception thrown when a value can't become a finite BigNumber.
 * @param value The value that failed.
 * @param error The error bignumber.js threw, if any.
 * @returns The INVALID_VALUE exception.
 */
export const buildInvalidValueException = (value: unknown, error?: unknown): Exception =>
  new Exception(
    error === undefined
      ? `BigNumber could not be instantiated with: ${describeValue(value)}.`
      : `BigNumber could not be instantiated with: ${describeValue(value)} | ${extractMessage(error)}`,
    ERRORS.INVALID_VALUE,
  );

/**
 * Builds the configuration used to process a value, applying the defaults: 2 decimal places,
 * ROUND_HALF_UP, and a number output. The decimal places apply to every rounding mode.
 * @param config The configuration given by the caller.
 * @returns The complete configuration.
 * @throws
 * - INVALID_DECIMAL_PLACES: if decimalPlaces is not a number or it is outside of the 0 - 100 range
 */
export const buildConfig = (config?: Partial<IConfig>): IConfig => {
  const decimalPlaces = config?.decimalPlaces ?? 2;
  validateDecimalPlaces(decimalPlaces);
  return {
    decimalPlaces,
    roundingMode: config?.roundingMode ?? 'ROUND_HALF_UP',
    type: config?.type ?? 'number',
  };
};

/**
 * Looks up the numeric rounding mode bignumber.js uses for a mode name.
 * @param name The rounding mode name.
 * @returns The numeric rounding mode.
 * @throws
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 */
const getRoundingMode = (name: IBigNumberRoundingModeName): IBigNumberRoundingMode => {
  const roundingMode = Object.hasOwn(ROUNDING_MODES, name) ? ROUNDING_MODES[name] : undefined;
  if (roundingMode === undefined) {
    throw new Exception(
      `The rounding mode '${describeValue(name)}' is invalid.`,
      ERRORS.INVALID_ROUNDING_MODE,
    );
  }
  return roundingMode;
};

/**
 * Rounds a BigNumber to a number of decimal places with a rounding mode.
 * @param value The value to round.
 * @param decimalPlaces The maximum number of decimal places.
 * @param roundingMode The rounding mode name.
 * @returns The rounded BigNumber.
 * @throws
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 */
export const roundBigNumber = (
  value: IBigNumber,
  decimalPlaces: number,
  roundingMode: IBigNumberRoundingModeName,
): IBigNumber => value.decimalPlaces(decimalPlaces, getRoundingMode(roundingMode));

/**
 * Converts a BigNumber into the requested type.
 * @param value The BigNumber.
 * @param type The output type.
 * @returns The converted value.
 * @throws
 * - INVALID_TYPE: if the processing type is not supported
 */
export const convertBigNumberToType = <T extends IType>(
  value: IBigNumber,
  type: T,
): IBigNumberToType<T> => {
  switch (type) {
    case 'string':
      return value.toString() as IBigNumberToType<T>;
    case 'number':
      return value.toNumber() as IBigNumberToType<T>;
    case 'bignumber':
      return value as IBigNumberToType<T>;
    default:
      throw new Exception(
        `The buildType '${describeValue(type)}' is invalid for '${value.toString()}'.`,
        ERRORS.INVALID_TYPE,
      );
  }
};

/**
 * Builds the format prettifyValue applies, filling in bignumber.js's defaults.
 * @param config The format settings given by the caller.
 * @returns The complete format.
 */
export const buildFormatConfig = (config?: Partial<IBigNumberFormat>): IBigNumberFormat => ({
  prefix: config?.prefix ?? '',
  negativeSign: config?.negativeSign ?? '-',
  positiveSign: config?.positiveSign ?? '',
  decimalSeparator: config?.decimalSeparator ?? '.',
  groupSeparator: config?.groupSeparator ?? ',',
  groupSize: config?.groupSize ?? 3,
  secondaryGroupSize: config?.secondaryGroupSize ?? 0,
  fractionGroupSeparator: config?.fractionGroupSeparator ?? ' ',
  fractionGroupSize: config?.fractionGroupSize ?? 0,
  suffix: config?.suffix ?? '',
});

/**
 * Builds a comparator that orders BigNumbers in a direction.
 * @param direction The sort direction.
 * @returns The comparator.
 */
export const sortBigNumbers =
  (direction: 'asc' | 'desc') =>
  (a: IBigNumber, b: IBigNumber): number => {
    if (a.isLessThan(b)) {
      return direction === 'asc' ? -1 : 1;
    }
    if (a.isGreaterThan(b)) {
      return direction === 'asc' ? 1 : -1;
    }
    return 0;
  };
