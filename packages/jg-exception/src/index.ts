// shared
export type { IJSONValue } from './shared/types.js';
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

// exception
export {
  type IExceptionJSON,
  type IExceptionOptions,
  Exception,
  isException,
} from './exception/index.js';
