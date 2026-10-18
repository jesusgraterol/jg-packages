import type { BigNumber } from 'bignumber.js';

/*
 * A BigNumber instance, created with `getBigNumber(value)` or the exported `BigNumber`
 * constructor. Every bignumber.js method is available on it.
 */
export type IBigNumber = BigNumber;

/*
 * How a value is rounded when it has more decimals than allowed:
 * - ROUND_UP: away from zero
 * - ROUND_DOWN: towards zero
 * - ROUND_CEIL: towards Infinity
 * - ROUND_FLOOR: towards -Infinity
 * - ROUND_HALF_UP (default): to the nearest neighbour, away from zero when equidistant
 * - ROUND_HALF_DOWN: to the nearest neighbour, towards zero when equidistant
 * - ROUND_HALF_EVEN: to the nearest neighbour, towards the even one when equidistant
 * - ROUND_HALF_CEIL: to the nearest neighbour, towards Infinity when equidistant
 * - ROUND_HALF_FLOOR: to the nearest neighbour, towards -Infinity when equidistant
 */
export type IBigNumberRoundingModeName =
  | 'ROUND_UP'
  | 'ROUND_DOWN'
  | 'ROUND_CEIL'
  | 'ROUND_FLOOR'
  | 'ROUND_HALF_UP'
  | 'ROUND_HALF_DOWN'
  | 'ROUND_HALF_EVEN'
  | 'ROUND_HALF_CEIL'
  | 'ROUND_HALF_FLOOR';

// the numeric rounding mode bignumber.js uses for each IBigNumberRoundingModeName
export type IBigNumberRoundingMode = BigNumber.RoundingMode;

// the values a BigNumber can be created from: numbers, numeric strings, and BigNumbers
export type IBigNumberValue = BigNumber.Value;

/*
 * How prettifyValue formats a value, with every setting of bignumber.js's toFormat, defaults in
 * parentheses: prefix (''), negativeSign ('-'), positiveSign (''), decimalSeparator ('.'),
 * groupSeparator (','), groupSize (3), secondaryGroupSize (0), fractionGroupSeparator (' '),
 * fractionGroupSize (0), and suffix ('').
 */
export type IBigNumberFormat = Required<BigNumber.Format>;

/*
 * The format prettifyValue takes: any of bignumber.js's toFormat settings, and the fewest decimals
 * it shows, padded with trailing zeros, such as 2 for '$1,234.50'. minimumDecimalPlaces defaults
 * to 0, and can't exceed the processing's decimalPlaces.
 */
export type IPrettifyFormat = Partial<IBigNumberFormat> & { minimumDecimalPlaces?: number };

// the type a processed value is returned as
export type IType = 'string' | 'number' | 'bignumber';

// how a value is processed
export type IConfig = {
  // the maximum number of decimals in the output. Defaults to 2
  decimalPlaces: number;

  // how the value is rounded when it has more decimals. Defaults to 'ROUND_HALF_UP'
  roundingMode: IBigNumberRoundingModeName;

  // the output's type. Defaults to 'number'
  type: IType;
};

// the TypeScript type of a value converted to an IType
export type IBigNumberToType<T> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'bignumber'
      ? IBigNumber
      : never;

// the return type of a function that processes a value, picked from its configuration's type
export type IOutput<T> = T extends { type: 'string' }
  ? string
  : T extends { type: 'number' }
    ? number
    : T extends { type: 'bignumber' }
      ? IBigNumber
      : number;
