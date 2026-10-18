// types
export type {
  IBigNumber,
  IBigNumberFormat,
  IBigNumberRoundingMode,
  IBigNumberRoundingModeName,
  IBigNumberToType,
  IBigNumberValue,
  IConfig,
  IOutput,
  IPrettifyFormat,
  IType,
} from './shared/types.js';

// constructor
export { BigNumber } from './shared/constants.js';

// error codes
export { ERRORS } from './shared/errors.js';

// value processors and type checks
export {
  getBigNumber,
  isBigNumber,
  isFloat,
  isInteger,
  isNumber,
  prettifyValue,
  processValue,
} from './processing/processing.js';

// scaled integers
export { fromScaledInteger, toScaledInteger } from './scaled-integers/scaled-integers.js';

// calculations
export {
  adjustByPercentage,
  calculateExchange,
  calculateExchangeFee,
  calculateMax,
  calculateMean,
  calculateMedian,
  calculateMin,
  calculatePercentageChange,
  calculatePercentageRepresentation,
  calculateSum,
  calculateWeightedEntry,
} from './calculations/calculations.js';
