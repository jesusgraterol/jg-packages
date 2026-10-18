// shared types
export type { IJsonValue, IUuidVersion } from './shared/types.js';

// error codes
export { ERRORS } from './shared/errors.js';

// validations
export { MAX_EMAIL_LENGTH } from './validations/index.js';

export {
  isStringValid,
  isNumberValid,
  isIntegerValid,
  isTimestampValid,
  isNumeric,
  isObjectValid,
  isArrayValid,
  isEmailValid,
  isFileNameValid,
  isSlugValid,
  isPasswordValid,
  isOTPSecretValid,
  isOTPTokenValid,
  isJwtValid,
  isAuthorizationHeaderValid,
  isSemverValid,
  isUrlValid,
  isUuidValid,
  isBigIntStringValid,
} from './validations/index.js';

// transformers
export type {
  ICursorValue,
  IDateTemplate,
  IDateValue,
  INumberFormatConfig,
  ISubstitutionOptions,
  ITimeString,
} from './transformers/index.js';

export {
  prettifyNumber,
  prettifyPercentage,
  toDate,
  toUtcDate,
  createTimestamp,
  prettifyDate,
  prettifyTime,
  prettifyFileSize,
  prettifyBadgeCount,
  capitalizeFirst,
  toTitleCase,
  toSlug,
  truncateText,
  truncateToUtf8Bytes,
  maskMiddle,
  normalizeQuery,
  stringifyValue,
  applySubstitutions,
  escapeHtml,
  pluralize,
  toMS,
  encodeBase64Url,
  decodeBase64Url,
  stringifyJson,
  stringifyJsonDeterministically,
  parseJson,
  pruneJson,
  encodeCursor,
  decodeCursor,
  ONE_SECOND_IN_MILLISECONDS,
  ONE_MINUTE_IN_MILLISECONDS,
  ONE_HOUR_IN_MILLISECONDS,
  ONE_DAY_IN_MILLISECONDS,
  ONE_WEEK_IN_MILLISECONDS,
  ONE_MONTH_IN_MILLISECONDS,
  ONE_YEAR_IN_MILLISECONDS,
} from './transformers/index.js';

// utilities
export type {
  IDelayOptions,
  IEventBus,
  IEventBusOptions,
  IFilterByQueryOptions,
  IRetryAsyncFunctionOptions,
  ISortDirection,
  IUtcDateRange,
  IWaitUntilOptions,
} from './utils/index.js';

export {
  applyDefaults,
  generateUuid,
  generateRandomString,
  generateRandomFloat,
  generateRandomInteger,
  generateSequence,
  generateDateId,
  getTrailingUtcDateRange,
  generateUtcDateSequence,
  sortPrimitives,
  sortRecords,
  sortRecordsWithBigIntString,
  sortRecordsWithDateValue,
  shuffleArray,
  splitArrayIntoBatches,
  pickProps,
  omitProps,
  isEqual,
  filterByQuery,
  resolveSafeInternalPath,
  delay,
  retryAsyncFunction,
  waitUntil,
  createEventBus,
  hasWindow,
  hasNavigator,
  isIndexedDbAvailable,
  prefersReducedMotion,
  extractTokenFromAuthorizationHeader,
  extractEmailUsername,
  getInitials,
  getNextPageParam,
  estimateReadingTime,
  extractFirstMarkdownHeadingName,
  extractSubstitutionPlaceholderNames,
} from './utils/index.js';
