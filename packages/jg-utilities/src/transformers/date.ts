import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';

import type { IDateTemplate, IDateValue, ITimeString } from './types.js';
import {
  DATE_LOCALE,
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_SECOND_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  ONE_YEAR_IN_MILLISECONDS,
} from './constants.js';
import { buildDateFormatOptions, parseTimeString } from './utilities.js';

/**
 * Creates an instance of Date based on a value.
 * @param value The value to create a Date instance from. It can be a Date object, a timestamp, or a date string.
 * @returns A Date instance.
 * @example
 * import { toDate } from 'jg-utilities';
 *
 * toDate('2026-10-17T08:30:00.000Z'); // a Date for that instant
 * toDate(1_792_217_505_000); // a Date from a millisecond epoch
 */
export const toDate = (value: IDateValue): Date => {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
};

// an ISO 8601 timestamp of a year from 0000 to 9999, whose first ten characters are its date
const FOUR_DIGIT_YEAR_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/;

/**
 * Gives the UTC calendar date of an instant, as `YYYY-MM-DD`, such as the day a UTC report or
 * analytics period counts it in. The instant must fall in the years 0000 to 9999.
 * @param value? The instant: a Date, a millisecond epoch, or a date string. Defaults to now.
 * @returns The UTC date, such as `2026-10-17`.
 * @example
 * import { toUtcDate } from 'jg-utilities';
 *
 * toUtcDate('2026-10-17T23:30:00.000-05:00'); // => '2026-10-18'
 * toUtcDate(0); // => '1970-01-01'
 * toUtcDate(); // today's UTC date
 * @throws
 * - INVALID_DATE: The value is not a valid date in the years 0000 to 9999.
 */
export const toUtcDate = (value?: IDateValue): string => {
  const date = value === undefined ? new Date() : toDate(value);
  const timestamp = Number.isNaN(date.getTime()) ? '' : date.toISOString();
  if (!FOUR_DIGIT_YEAR_TIMESTAMP.test(timestamp)) {
    throw new Exception('The value is not a valid date in the years 0000 to 9999.', {
      code: ERRORS.INVALID_DATE,
      data: { value: String(value) },
    });
  }
  return timestamp.slice(0, 10);
};

/**
 * Formats a date instance based on a template. The output is always en-US, whatever the runtime's
 * locale, and hours have no leading zero.
 * - date-short: 12/05/2024 (Default)
 * - date-medium: December 5, 2024
 * - date-long: Thursday, December 5, 2024
 * - time-short: 9:05 PM
 * - time-medium: 9:05:20 PM
 * - datetime-short: 12/5/2024, 9:05 PM
 * - datetime-medium: December 5, 2024 at 9:05 PM
 * - datetime-long: Thursday, December 5, 2024 at 9:05:20 PM
 *
 * Without a time zone, the runtime's local zone is used, so a server and a browser can format the
 * same instant differently. Pass 'UTC' for calendar dates and for data defined in UTC periods, and
 * an explicit time zone for server-rendered output. Templates with a time end with the zone's short
 * name when a time zone is given, for example "December 5, 2024 at 11:30 PM UTC". Prefer
 * date-medium, datetime-medium and time-medium in UI text over the numeric templates.
 * @param value The date value to be formatted. It can be a Date object, a timestamp, or a date string.
 * @param template The template to use for formatting the date. Defaults to date-short.
 * @param timeZone? The IANA time zone to format in, such as 'UTC'. Defaults to the runtime's time zone.
 * @returns A string representing the formatted date.
 * @example
 * import { prettifyDate } from 'jg-utilities';
 *
 * prettifyDate('2026-10-17T08:30:00.000Z', 'date-medium', 'UTC'); // => 'October 17, 2026'
 * prettifyDate('2026-10-17T08:30:00.000Z', 'datetime-short', 'UTC'); // => '10/17/2026, 8:30 AM UTC'
 * @throws
 * - A RangeError if the time zone is unknown.
 */
export const prettifyDate = (
  value: IDateValue,
  template: IDateTemplate = 'date-short',
  timeZone?: string,
): string => toDate(value).toLocaleString(DATE_LOCALE, buildDateFormatOptions(template, timeZone));

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param milliseconds The duration in milliseconds.
 * @returns A string representing the formatted duration.
 * @example
 * import { prettifyTime } from 'jg-utilities';
 *
 * prettifyTime(3_725_000); // => '1h 2m'
 * prettifyTime(45_000); // => '45s'
 */
export const prettifyTime = (milliseconds: number): string => {
  const safeSeconds = Number.isFinite(milliseconds)
    ? Math.max(0, Math.floor(milliseconds / 1000))
    : 0;
  const days = Math.floor(safeSeconds / 86_400);
  const hours = Math.floor((safeSeconds % 86_400) / 3_600);
  const minutes = Math.floor((safeSeconds % 3_600) / 60);
  const seconds = safeSeconds % 60;
  const parts = [
    days > 0 ? `${days}d` : null,
    hours > 0 ? `${hours}h` : null,
    minutes > 0 ? `${minutes}m` : null,
    days === 0 && hours === 0 && minutes === 0 ? `${seconds}s` : null,
  ].filter((part): part is string => typeof part === 'string');

  return parts.join(' ');
};

/**
 * Converts a time string into milliseconds. The time string should be in the format of "{value} {unit}",
 * where the value is a number and the unit can be milliseconds, seconds, minutes, hours, days, weeks,
 * months, or years. For example: "2 days", "5 minutes", "2 hours".
 * @param str The time string to convert into milliseconds.
 * @returns The equivalent time in milliseconds.
 * @example
 * import { toMS } from 'jg-utilities';
 *
 * toMS('2 days'); // => 172800000
 * toMS('30 minutes'); // => 1800000
 * @throws
 * - INVALID_TIME_STRING: if the provided time string is not a valid string.
 * - INVALID_TIME_STRING: if the chunks do not match the expected format.
 * - INVALID_TIME_STRING: if the value is not a valid positive integer.
 * - INVALID_TIME_STRING: if the unit is not one of the accepted values.
 */
export const toMS = (str: ITimeString): number => {
  const { value, unit } = parseTimeString(str);
  switch (unit) {
    case 'years':
    case 'year':
      return value * ONE_YEAR_IN_MILLISECONDS;
    case 'months':
    case 'month':
      return value * ONE_MONTH_IN_MILLISECONDS;
    case 'weeks':
    case 'week':
      return value * ONE_WEEK_IN_MILLISECONDS;
    case 'days':
    case 'day':
      return value * ONE_DAY_IN_MILLISECONDS;
    case 'hours':
    case 'hour':
      return value * ONE_HOUR_IN_MILLISECONDS;
    case 'minutes':
    case 'minute':
      return value * ONE_MINUTE_IN_MILLISECONDS;
    case 'seconds':
    case 'second':
      return value * ONE_SECOND_IN_MILLISECONDS;
    case 'milliseconds':
    case 'millisecond':
      return value;
    default:
      throw new Exception(
        `The unit provided to the toMS function is invalid: "${unit}". Received: ${str}`,
        { code: ERRORS.INVALID_TIME_STRING },
      );
  }
};

/**
 * Creates an ISO 8601 timestamp, in UTC, from a date, a millisecond epoch, or a date string, or
 * from the current time when no value is given.
 * @param value The moment to format. Defaults to now.
 * @returns The timestamp, such as `2026-10-17T08:30:00.000Z`.
 * @example
 * import { createTimestamp } from 'jg-utilities';
 *
 * createTimestamp(); // the current time, such as '2026-10-17T08:30:00.000Z'
 * createTimestamp(0); // => '1970-01-01T00:00:00.000Z'
 * @throws
 * - Invalid time value
 */
export const createTimestamp = (value?: Date | number | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'number' || typeof value === 'string') {
    return new Date(value).toISOString();
  }
  return new Date().toISOString();
};
