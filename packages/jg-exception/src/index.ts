// shared
export type { IJsonValue } from './shared/types.js';
export { DEFAULT_MESSAGE, UNKNOWN_ERROR_CODE } from './shared/constants.js';

// error handler
export {
  extractMessage,
  extractRedactedMessage,
  getErrorCode,
  hasErrorCode,
  hasErrorCodePrefix,
  isDefaultErrorMessage,
} from './error-handler/index.js';

// field redaction
export { redactFields } from './redact-fields/index.js';

// exception
export {
  type IExceptionJson,
  type IExceptionOptions,
  Exception,
  isException,
} from './exception/index.js';
