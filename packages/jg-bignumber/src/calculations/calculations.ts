import { BigNumber } from '../shared/constants.js';
import type { IBigNumber, IBigNumberValue, IConfig, IOutput } from '../shared/types.js';
import { getBigNumber, processValue } from '../processing/processing.js';
import { sortBigNumbers } from '../utils/utils.js';
import { validatePositiveValue, validateValuesArray } from '../validations/validations.js';

/*
 * Essential calculations
 */

/**
 * Adds up a list of values. An empty list sums to 0.
 * @param values The values.
 * @param config How the result is processed.
 * @returns The sum.
 * @example
 * import { calculateSum } from 'jg-bignumber';
 *
 * calculateSum([0.1, '0.2', 0.3]); // => 0.6
 * calculateSum([0.1, 0.2], { type: 'string' }); // => '0.3'
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateSum = <T extends Partial<IConfig>>(
  values: IBigNumberValue[],
  config?: T,
): IOutput<T> => {
  validateValuesArray(values, 'calculateSum');
  return processValue(values.length > 0 ? BigNumber.sum(...values) : 0, config);
};

/**
 * Finds the smallest value in a list. An empty list returns 0.
 * @param values The values.
 * @param config How the result is processed.
 * @returns The smallest value.
 * @example
 * import { calculateMin } from 'jg-bignumber';
 *
 * calculateMin([3, '1.5', 2]); // => 1.5
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateMin = <T extends Partial<IConfig>>(
  values: IBigNumberValue[],
  config?: T,
): IOutput<T> => {
  validateValuesArray(values, 'calculateMin');
  return processValue(values.length > 0 ? BigNumber.min(...values) : 0, config);
};

/**
 * Finds the largest value in a list. An empty list returns 0.
 * @param values The values.
 * @param config How the result is processed.
 * @returns The largest value.
 * @example
 * import { calculateMax } from 'jg-bignumber';
 *
 * calculateMax([3, '1.5', 2]); // => 3
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateMax = <T extends Partial<IConfig>>(
  values: IBigNumberValue[],
  config?: T,
): IOutput<T> => {
  validateValuesArray(values, 'calculateMax');
  return processValue(values.length > 0 ? BigNumber.max(...values) : 0, config);
};

/**
 * Calculates the mean of a list of values. An empty list returns 0.
 * @param values The values.
 * @param config How the result is processed.
 * @returns The mean.
 * @example
 * import { calculateMean } from 'jg-bignumber';
 *
 * calculateMean([1, 2, 4]); // => 2.33
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateMean = <T extends Partial<IConfig>>(
  values: IBigNumberValue[],
  config?: T,
): IOutput<T> => {
  validateValuesArray(values, 'calculateMean');
  if (values.length > 0) {
    return processValue(BigNumber.sum(...values).dividedBy(values.length), config);
  }
  return processValue(0, config);
};

/**
 * Calculates the median of a list of values: the middle value, or the mean of the two middle
 * values when the list has an even length. An empty list returns 0.
 * @param values The values.
 * @param config How the result is processed.
 * @returns The median.
 * @example
 * import { calculateMedian } from 'jg-bignumber';
 *
 * calculateMedian([5, 1, 3]); // => 3
 * calculateMedian([4, 1, 3, 2]); // => 2.5
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateMedian = <T extends Partial<IConfig>>(
  values: IBigNumberValue[],
  config?: T,
): IOutput<T> => {
  validateValuesArray(values, 'calculateMedian');
  if (values.length === 0) {
    return processValue(0, config);
  }
  const half = Math.floor(values.length / 2);
  const sorted = values.map(getBigNumber).sort(sortBigNumbers('asc'));
  const middle = sorted[half] as IBigNumber;
  const median =
    values.length % 2 === 1 ? middle : (sorted[half - 1] as IBigNumber).plus(middle).dividedBy(2);
  return processValue(median, config);
};

/*
 * Percentage calculations
 */

/**
 * Calculates the percentage a value changed by: positive when it increased, negative when it
 * decreased, and 0 when it didn't change. The largest decrease is -100%, returned whenever the new
 * value is 0 or less.
 * @param oldValue The value before the change.
 * @param newValue The value after the change.
 * @param config How the result is processed.
 * @returns The percentage change.
 * @example
 * import { calculatePercentageChange } from 'jg-bignumber';
 *
 * calculatePercentageChange(100, 125); // => 25
 * calculatePercentageChange(100, 80); // => -20
 * calculatePercentageChange(100, 0); // => -100
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the oldValue is not positive
 */
export const calculatePercentageChange = <T extends Partial<IConfig>>(
  oldValue: IBigNumberValue,
  newValue: IBigNumberValue,
  config?: T,
): IOutput<T> => {
  const oldValueBN = getBigNumber(oldValue);
  const newValueBN = getBigNumber(newValue);
  validatePositiveValue(oldValueBN);

  let change: IBigNumber;
  if (newValueBN.isGreaterThan(oldValueBN)) {
    change = newValueBN.minus(oldValueBN).dividedBy(oldValueBN).times(100);
  } else if (oldValueBN.isGreaterThan(newValueBN)) {
    change = newValueBN.isGreaterThan(0)
      ? oldValueBN.minus(newValueBN).dividedBy(oldValueBN).times(100).negated()
      : getBigNumber(-100);
  } else {
    change = getBigNumber(0);
  }
  return processValue(change, config);
};

/**
 * Changes a value by a percentage: a positive percentage increases it, and a negative one
 * decreases it, to 0 at most.
 * @param value The value to change.
 * @param percentage The percentage to change it by.
 * @param config How the result is processed.
 * @returns The changed value.
 * @example
 * import { adjustByPercentage } from 'jg-bignumber';
 *
 * adjustByPercentage(100, 25); // => 125
 * adjustByPercentage(100, -10); // => 90
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the value is not positive
 */
export const adjustByPercentage = <T extends Partial<IConfig>>(
  value: IBigNumberValue,
  percentage: IBigNumberValue,
  config?: T,
): IOutput<T> => {
  const valueBN = getBigNumber(value);
  const percentageBN = getBigNumber(percentage);
  validatePositiveValue(valueBN);

  let adjusted: IBigNumber;
  if (percentageBN.isGreaterThan(0)) {
    adjusted = percentageBN.dividedBy(100).plus(1).times(valueBN);
  } else if (percentageBN.isLessThan(0)) {
    adjusted = percentageBN.isGreaterThan(-100)
      ? percentageBN.times(-1).dividedBy(100).minus(1).times(valueBN).times(-1)
      : getBigNumber(0);
  } else {
    adjusted = valueBN;
  }
  return processValue(adjusted, config);
};

/**
 * Calculates what percentage of a total a value represents.
 * @param value The part.
 * @param total The total.
 * @param config How the result is processed.
 * @returns The percentage.
 * @example
 * import { calculatePercentageRepresentation } from 'jg-bignumber';
 *
 * calculatePercentageRepresentation(25, 200); // => 12.5
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the value or total are not positive
 */
export const calculatePercentageRepresentation = <T extends Partial<IConfig>>(
  value: IBigNumberValue,
  total: IBigNumberValue,
  config?: T,
): IOutput<T> => {
  const valueBN = getBigNumber(value);
  const totalBN = getBigNumber(total);
  validatePositiveValue(valueBN, true);
  validatePositiveValue(totalBN);
  return processValue(valueBN.times(100).dividedBy(totalBN), config);
};

/*
 * Financial calculations
 */

/**
 * Calculates the amount of an asset an exchange gives for a value at a rate, such as how much
 * BTC 100 USDT buys at 65,000 USDT per BTC.
 * @param value The amount being exchanged.
 * @param rate The price of one unit of the asset received.
 * @param config How the result is processed.
 * @returns The amount received.
 * @example
 * import { calculateExchange } from 'jg-bignumber';
 *
 * calculateExchange(100, 65000, { decimalPlaces: 8 }); // => 0.00153846
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the value or rate are not positive
 */
export const calculateExchange = <T extends Partial<IConfig>>(
  value: IBigNumberValue,
  rate: IBigNumberValue,
  config?: T,
): IOutput<T> => {
  const valueBN = getBigNumber(value);
  const rateBN = getBigNumber(rate);
  validatePositiveValue(valueBN);
  validatePositiveValue(rateBN);
  return processValue(valueBN.dividedBy(rateBN), config);
};

/**
 * Calculates the fee charged for an exchange, as a percentage of the value exchanged.
 * @param value The amount being exchanged.
 * @param feePercentage The fee, as a percentage.
 * @param config How the result is processed.
 * @returns The fee.
 * @example
 * import { calculateExchangeFee } from 'jg-bignumber';
 *
 * calculateExchangeFee(1000, 0.1); // => 1
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - NEGATIVE_VALUE_NOT_ALLOWED: if the value or feePercentage are not positive
 */
export const calculateExchangeFee = <T extends Partial<IConfig>>(
  value: IBigNumberValue,
  feePercentage: IBigNumberValue,
  config?: T,
): IOutput<T> => {
  const valueBN = getBigNumber(value);
  const feePercentageBN = getBigNumber(feePercentage);
  validatePositiveValue(valueBN);
  validatePositiveValue(feePercentageBN, true);
  return processValue(feePercentageBN.times(valueBN).dividedBy(100), config);
};

/**
 * Calculates the average entry price of a position bought in several trades, weighting each price
 * by the amount bought. An empty list, or one whose amounts add up to 0, returns 0.
 * @param trades The trades, each as a `[price, amount]` tuple.
 * @param config How the result is processed.
 * @returns The weighted average price.
 * @example
 * import { calculateWeightedEntry } from 'jg-bignumber';
 *
 * calculateWeightedEntry([[100, 2], [130, 1]]); // => 110
 * calculateWeightedEntry([]); // => 0
 * @throws
 * - INVALID_VALUE: if any of the given values isn't a finite number or BigNumber throws an error
 * - INVALID_DECIMAL_PLACES: if the number of decimal places is invalid for any reason
 * - INVALID_ROUNDING_MODE: if the rounding mode name is not supported
 * - INVALID_TYPE: if the processing type is not supported
 * - INVALID_VALUES_ARRAY: if the provided values arg is not a valid array
 */
export const calculateWeightedEntry = <T extends Partial<IConfig>>(
  trades: [IBigNumberValue, IBigNumberValue][],
  config?: T,
): IOutput<T> => {
  validateValuesArray(trades, 'calculateWeightedEntry');
  if (trades.length === 0) {
    return processValue(0, config);
  }
  let priceTimesShares = getBigNumber(0);
  let totalShares = getBigNumber(0);
  trades.forEach(([price, amount]) => {
    const amountBN = getBigNumber(amount);
    priceTimesShares = priceTimesShares.plus(getBigNumber(price).times(amountBN));
    totalShares = totalShares.plus(amountBN);
  });
  if (totalShares.isZero()) {
    return processValue(0, config);
  }
  return processValue(priceTimesShares.dividedBy(totalShares), config);
};
