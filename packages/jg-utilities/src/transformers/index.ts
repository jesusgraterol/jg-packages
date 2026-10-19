// types
export type {
  IDateTemplate,
  IDateValue,
  INumberFormatConfig,
  ISubstitutionOptions,
  ITimeString,
} from './types.js';

// base64url transformers
export { decodeBase64Url, encodeBase64Url } from './base64url.js';

// date transformers
export { createTimestamp, prettifyDate, prettifyTime, toDate, toMS, toUtcDate } from './date.js';

// cursor transformers
export { type ICursorValue, decodeCursor, encodeCursor } from './cursor.js';

// time constants
export {
  ONE_DAY_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_SECOND_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  ONE_YEAR_IN_MILLISECONDS,
} from './constants.js';

// JSON transformers
export { parseJson, pruneJson, stringifyJson, stringifyJsonDeterministically } from './json.js';

// number transformers
export {
  prettifyBadgeCount,
  prettifyFileSize,
  prettifyNumber,
  prettifyPercentage,
} from './number.js';

// string transformers
export {
  applySubstitutions,
  capitalizeFirst,
  escapeHtml,
  maskMiddle,
  normalizeQuery,
  pluralize,
  stringifyValue,
  toSlug,
  toTitleCase,
  truncateText,
  truncateToUtf8Bytes,
} from './string.js';
