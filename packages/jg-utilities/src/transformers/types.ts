/* ************************************************************************************************
 *                                            NUMBERS                                             *
 ************************************************************************************************ */

/**
 * Number Format Configuration
 * The configuration that will be used to prettify a number.
 */
export type INumberFormatConfig = {
  minimumFractionDigits: number; // Default: 0
  maximumFractionDigits: number; // Default: 2
  prefix: string; // Default: ''
  suffix: string; // Default: ''
};

/* ************************************************************************************************
 *                                             DATES                                              *
 ************************************************************************************************ */

// the value that can be used to create a Date instance
export type IDateValue = Date | number | string;

/**
 * Date Template
 * A date can be prettified by choosing a template that meets the user's requirements.
 * - date-short: 12/05/2024
 * - date-medium: December 5, 2024
 * - date-long: Thursday, December 5, 2024
 * - time-short: 9:05 PM
 * - time-medium: 9:05:20 PM
 * - datetime-short: 12/5/2024, 9:05 PM
 * - datetime-medium: December 5, 2024 at 9:05 PM
 * - datetime-long: Thursday, December 5, 2024 at 9:05:20 PM
 */
export type IDateTemplate =
  | 'date-short'
  | 'date-medium'
  | 'date-long'
  | 'time-short'
  | 'time-medium'
  | 'datetime-short'
  | 'datetime-medium'
  | 'datetime-long';

/**
 * Date Template Configs
 * The options that will be combined in order to provide a format that can meet any requirement.
 */
export type IDateTemplateConfigs = {
  [key in IDateTemplate]: {
    localeMatcher?: 'best fit' | 'lookup' | undefined;
    weekday?: 'long' | 'short' | 'narrow' | undefined;
    era?: 'long' | 'short' | 'narrow' | undefined;
    year?: 'numeric' | '2-digit' | undefined;
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined;
    day?: 'numeric' | '2-digit' | undefined;
    hour?: 'numeric' | '2-digit' | undefined;
    minute?: 'numeric' | '2-digit' | undefined;
    second?: 'numeric' | '2-digit' | undefined;
    timeZoneName?:
      'short' | 'long' | 'shortOffset' | 'longOffset' | 'shortGeneric' | 'longGeneric' | undefined;
    formatMatcher?: 'best fit' | 'basic' | undefined;
    hour12?: boolean | undefined;
    timeZone?: string | undefined;
  };
};

/* ************************************************************************************************
 *                                          TIME STRING                                           *
 ************************************************************************************************ */

/**
 * Time String
 * The following types were extracted from the 'ms' package, which is a popular library for parsing
 * and formatting time durations. For more information, please refer to the original source:
 * https://github.com/vercel/ms
 */
type IYears = 'years' | 'year';
type IMonths = 'months' | 'month';
type IWeeks = 'weeks' | 'week';
type IDays = 'days' | 'day';
type IHours = 'hours' | 'hour';
type IMinutes = 'minutes' | 'minute';
type ISeconds = 'seconds' | 'second';
type IMilliseconds = 'milliseconds' | 'millisecond';

export type IUnit =
  IYears | IMonths | IWeeks | IDays | IHours | IMinutes | ISeconds | IMilliseconds;

// a duration such as '2 days' or '30 minutes', which toMS converts to milliseconds
export type ITimeString = `${number} ${IUnit}`;

/* ************************************************************************************************
 *                                         SUBSTITUTIONS                                          *
 ************************************************************************************************ */

// the options that can be passed to the applySubstitutions function
export type ISubstitutionOptions = {
  jsonIndent: number;
};
