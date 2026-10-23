// the message used when none can be extracted from an error
export const DEFAULT_MESSAGE =
  'The error message could not be extracted, check the logs for more information.';

// the code given to an error that has none, such as when it's sent in an API envelope
export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

// the marker that replaces each redacted value, in messages, data, causes, and fields
export const REDACTED_VALUE = '[redacted]';

/*
 * The most levels the package walks into an error's data, or down its chain of causes. Data nested
 * deeper is treated as data that can't be copied or serialized, and deeper causes are left out, so
 * the result never depends on how much of the call stack is left.
 */
export const MAX_NESTING_DEPTH = 256;
