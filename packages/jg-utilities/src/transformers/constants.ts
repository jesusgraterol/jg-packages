import type { IDateTemplate, IDateTemplateConfigs, IUnit } from './types.js';

/* ************************************************************************************************
 *                                            NUMBERS                                             *
 ************************************************************************************************ */

// values needed to format a file size value into a readable string
export const FILE_SIZE_THRESHOLD: number = 1024;
export const FILE_SIZE_UNITS: string[] = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

/* ************************************************************************************************
 *                                             DATES                                              *
 ************************************************************************************************ */

// the locale every date is formatted in, so output doesn't depend on the runtime's locale
export const DATE_LOCALE = 'en-US';

// the templates that include a time, which get the time zone's name when a time zone is provided
export const DATE_TEMPLATES_WITH_TIME: IDateTemplate[] = [
  'time-short',
  'time-medium',
  'datetime-short',
  'datetime-medium',
  'datetime-long',
];

// the configurations that will be used to prettify dates
export const DATE_TEMPLATE_CONFIGS: IDateTemplateConfigs = {
  'date-short': {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  },
  'date-medium': {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
  'date-long': {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  },
  'time-short': {
    hour: 'numeric',
    minute: '2-digit',
  },
  'time-medium': {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
  'datetime-short': {
    day: 'numeric',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
  'datetime-medium': {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
  'datetime-long': {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
};

/* ************************************************************************************************
 *                                           BASE64URL                                            *
 ************************************************************************************************ */

// the characters a base64url value can hold (no padding)
export const BASE64URL_PATTERN = /^[A-Za-z0-9_-]*$/;

// the bytes converted per String.fromCharCode call, kept well below the engines' argument limits
export const BINARY_STRING_CHUNK_SIZE = 32768;

/* ************************************************************************************************
 *                                          TIME STRING                                           *
 ************************************************************************************************ */

// the units that can be used in a time string
export const TIME_STRING_UNITS: IUnit[] = [
  'milliseconds',
  'millisecond',
  'seconds',
  'second',
  'minutes',
  'minute',
  'hours',
  'hour',
  'days',
  'day',
  'weeks',
  'week',
  'months',
  'month',
  'years',
  'year',
];

// one second in milliseconds
export const ONE_SECOND_IN_MILLISECONDS = 1000;

// one minute in milliseconds
export const ONE_MINUTE_IN_MILLISECONDS = ONE_SECOND_IN_MILLISECONDS * 60;

// one hour in milliseconds
export const ONE_HOUR_IN_MILLISECONDS = ONE_MINUTE_IN_MILLISECONDS * 60;

// one day in milliseconds
export const ONE_DAY_IN_MILLISECONDS = ONE_HOUR_IN_MILLISECONDS * 24;

// one week in milliseconds
export const ONE_WEEK_IN_MILLISECONDS = ONE_DAY_IN_MILLISECONDS * 7;

// one average year, of 365.25 days, in milliseconds
export const ONE_YEAR_IN_MILLISECONDS = ONE_DAY_IN_MILLISECONDS * 365.25;

// one average month, a twelfth of an average year, in milliseconds
export const ONE_MONTH_IN_MILLISECONDS = ONE_YEAR_IN_MILLISECONDS / 12;

/* ************************************************************************************************
 *                                           REDACTION                                            *
 ************************************************************************************************ */

/*
 * The single-line secrets redactSecrets finds by default: GitHub's personal, OAuth, user, server,
 * and refresh tokens, its fine-grained personal access tokens, and `sk-` API keys, such as
 * OpenAI's, each with at least 20 characters after its prefix.
 */
export const SECRET_TOKEN_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/gu,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gu,
  /\bsk-[A-Za-z0-9_-]{20,}\b/gu,
];

// the BEGIN and END lines of a PEM private key block, of any key type
export const PRIVATE_KEY_BOUNDARY_PATTERN = /-----(BEGIN|END) [A-Z ]*PRIVATE KEY-----/gu;
