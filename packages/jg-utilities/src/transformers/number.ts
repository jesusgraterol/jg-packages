import type { INumberFormatConfig } from './types.js';
import { FILE_SIZE_THRESHOLD, FILE_SIZE_UNITS } from './constants.js';
import { buildNumberFormatConfig, formatLargeFileSize } from './utilities.js';

/**
 * Formats a numeric value based on the user's default language. A negative value's sign goes
 * before the prefix, as in `-$5`.
 * @param value The number to be formatted.
 * @param configuration? An optional configuration object.
 * @returns A string representing the formatted number.
 * @example
 * import { prettifyNumber } from 'jg-utilities';
 *
 * prettifyNumber(1234567.891); // => '1,234,567.89'
 * prettifyNumber(19.5, { minimumFractionDigits: 2, prefix: '$' }); // => '$19.50'
 * prettifyNumber(-5, { prefix: '$' }); // => '-$5'
 */
export const prettifyNumber = (
  value: number,
  configuration?: Partial<INumberFormatConfig>,
): string => {
  const config = buildNumberFormatConfig(configuration);
  const parts = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.maximumFractionDigits,
  }).formatToParts(value);
  // the language's own minus sign, moved before the prefix
  const sign = parts.find(({ type }) => type === 'minusSign')?.value ?? '';
  const digits = parts
    .filter(({ type }) => type !== 'minusSign')
    .map((part) => part.value)
    .join('');
  return `${sign}${config.prefix}${digits}${config.suffix}`;
};

/**
 * Formats a numeric value as a percentage based on the user's default language.
 * @param value The number to be formatted as a percentage - whole value (e.g., 50 for 50%)
 * @param configuration? An optional configuration object.
 * @returns A string representing the formatted percentage.
 * @example
 * import { prettifyPercentage } from 'jg-utilities';
 *
 * prettifyPercentage(12.345); // => '12.35%'
 * prettifyPercentage(-3); // => '-3%'
 */
export const prettifyPercentage = (
  value: number,
  configuration?: Partial<INumberFormatConfig>,
): string => {
  const config = buildNumberFormatConfig(configuration);
  const prettifiedValue = value.toLocaleString(undefined, {
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.maximumFractionDigits,
  });
  return `${config.prefix}${prettifiedValue}%${config.suffix}`;
};

/**
 * Formats a bytes value into a human readable format. Bigints, such as BIGINT database values, are
 * accepted too; values beyond Number.MAX_SAFE_INTEGER are formatted without losing precision.
 * @param value The bytes value to be formatted, as a number or a bigint.
 * @param decimalPlaces The number of decimal places to include. Defaults to 2.
 * @returns A string representing the formatted file size.
 * @example
 * import { prettifyFileSize } from 'jg-utilities';
 *
 * prettifyFileSize(1536); // => '1.50 kB'
 * prettifyFileSize(3_250_000_000, 1); // => '3.0 GB'
 */
export const prettifyFileSize = (value: number | bigint, decimalPlaces: number = 2): string => {
  if (typeof value === 'bigint') {
    if (value <= 0n) {
      return '0 B';
    }
    return value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? prettifyFileSize(Number(value), decimalPlaces)
      : formatLargeFileSize(value, decimalPlaces);
  }
  if (typeof value === 'number' && value > 0) {
    let bytes = value;

    // if the value is tiny, return it in bytes
    if (Math.abs(value) < FILE_SIZE_THRESHOLD) {
      return `${value} B`;
    }

    // iterate until the best unit of measure is found
    let unitIndex = -1;
    const decimalMultiplier = 10 ** decimalPlaces;
    do {
      bytes /= FILE_SIZE_THRESHOLD;
      unitIndex += 1;
    } while (
      Math.round(Math.abs(bytes) * decimalMultiplier) / decimalMultiplier >= FILE_SIZE_THRESHOLD &&
      unitIndex < FILE_SIZE_UNITS.length - 1
    );

    return `${bytes.toFixed(decimalPlaces)} ${FILE_SIZE_UNITS[unitIndex]}`;
  }
  return '0 B';
};

/**
 * Formats the number that will be inserted in a badge so it doesn't take too much space. If the
 * current count is 0, it returns undefined as the badge shouldn't be displayed.
 * @param value The current count to be displayed in the badge.
 * @param maxValue The maximum value to display before showing a "+" sign. Defaults to 9.
 * @returns A string representing the formatted badge count or undefined if the count is 0.
 * @example
 * import { prettifyBadgeCount } from 'jg-utilities';
 *
 * prettifyBadgeCount(3); // => '3'
 * prettifyBadgeCount(42); // => '9+'
 * prettifyBadgeCount(0); // => undefined
 */
export const prettifyBadgeCount = (value: number, maxValue: number = 9): string | undefined => {
  if (value === 0) {
    return undefined;
  }
  if (value >= maxValue) {
    return `${maxValue}+`;
  }
  return String(value);
};
