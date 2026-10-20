import type {
  IDateTemplate,
  IDateTemplateConfigs,
  INumberFormatConfig,
  ITimeString,
} from './types.js';
import {
  BINARY_STRING_CHUNK_SIZE,
  DATE_TEMPLATE_CONFIGS,
  DATE_TEMPLATES_WITH_TIME,
  FILE_SIZE_THRESHOLD,
  FILE_SIZE_UNITS,
} from './constants.js';
import {
  validateTimeStringChunks,
  validateTimeStringType,
  validateTimeStringValue,
} from './validations.js';

/**
 * Builds the object that will be passed to the number formatting function.
 * @param config? The optional configuration object for number formatting.
 * @returns The configuration object for number formatting with default values applied.
 */
export const buildNumberFormatConfig = (
  config: Partial<INumberFormatConfig> = {},
): INumberFormatConfig => ({
  minimumFractionDigits: config.minimumFractionDigits ?? 0,
  maximumFractionDigits: config.maximumFractionDigits ?? 2,
  prefix: config.prefix ?? '',
  suffix: config.suffix ?? '',
});

/**
 * Parses a time string and returns an object containing the value and the unit.
 * @param str The time string to parse.
 * @returns The parsed time string as an object containing the value and the unit.
 * @throws
 * - INVALID_TIME_STRING: if the provided time string is not a valid string.
 * - INVALID_TIME_STRING: if the chunks do not match the expected format.
 * - INVALID_TIME_STRING: if the value is not a valid positive integer.
 */
export const parseTimeString = (str: ITimeString): { value: number; unit: string } => {
  // ensure the provided value is a valid string
  validateTimeStringType(str);

  // separate the value and the unit and ensure they are both present
  const chunks = str.split(' ');
  validateTimeStringChunks(chunks);

  // cast the value to a number and ensure it's a positive integer
  const value = Number(chunks[0]);
  validateTimeStringValue(value);

  // finally, return the value and the unit
  return { value, unit: chunks[1] ?? '' };
};

/**
 * Builds the options used to format a date with a template. A time zone applies to every template,
 * and templates that include a time also get the zone's short name.
 * @param template The template whose options are built.
 * @param timeZone? The IANA time zone to format in. Defaults to the runtime's time zone.
 * @returns The options for Date.prototype.toLocaleString.
 */
export const buildDateFormatOptions = (
  template: IDateTemplate,
  timeZone?: string,
): IDateTemplateConfigs[IDateTemplate] => {
  if (timeZone === undefined) {
    return DATE_TEMPLATE_CONFIGS[template];
  }
  return DATE_TEMPLATES_WITH_TIME.includes(template)
    ? { ...DATE_TEMPLATE_CONFIGS[template], timeZone, timeZoneName: 'short' }
    : { ...DATE_TEMPLATE_CONFIGS[template], timeZone };
};

/**
 * Divides two positive bigints, rounding halves up.
 * @param dividend The value to divide.
 * @param divisor The value to divide by.
 * @returns The rounded quotient.
 */
const divideRoundingHalfUp = (dividend: bigint, divisor: bigint): bigint =>
  (dividend * 2n + divisor) / (divisor * 2n);

/**
 * Formats a positive bigint bytes value that exceeds Number.MAX_SAFE_INTEGER. It selects the unit
 * and rounds exactly like the number path, but with bigint arithmetic so no precision is lost.
 * @param value The bytes value to format.
 * @param decimalPlaces The number of decimal places to include.
 * @returns A string representing the formatted file size.
 */
export const formatLargeFileSize = (value: bigint, decimalPlaces: number): string => {
  const places = Math.max(0, Math.trunc(decimalPlaces));
  const scale = 10n ** BigInt(places);
  const threshold = BigInt(FILE_SIZE_THRESHOLD);
  let unitIndex = 0;
  let divisor = threshold;
  let scaledSize = divideRoundingHalfUp(value * scale, divisor);
  while (scaledSize >= threshold * scale && unitIndex < FILE_SIZE_UNITS.length - 1) {
    unitIndex += 1;
    divisor *= threshold;
    scaledSize = divideRoundingHalfUp(value * scale, divisor);
  }
  const integerPart = (scaledSize / scale).toString();
  const fractionPart = (scaledSize % scale).toString().padStart(places, '0');
  const size = places > 0 ? `${integerPart}.${fractionPart}` : integerPart;
  return `${size} ${FILE_SIZE_UNITS[unitIndex]}`;
};

/**
 * Converts bytes into a binary string, one character per byte, as btoa expects.
 * @param bytes The bytes to convert.
 * @returns The binary string.
 */
export const bytesToBinaryString = (bytes: Uint8Array): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BINARY_STRING_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BINARY_STRING_CHUNK_SIZE));
  }
  return binary;
};
