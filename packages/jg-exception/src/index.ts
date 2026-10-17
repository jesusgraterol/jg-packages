// shared
export type { IDecodedError, IErrorCode, IErrorCodeCarrier } from './shared/types.js';
export { DEFAULT_CODE, DEFAULT_MESSAGE } from './shared/constants.js';

// error handler
export {
  decodeError,
  encodeError,
  extractMessage,
  extractRedactedMessage,
  getErrorCode,
  hasErrorCode,
  hasErrorCodePrefix,
  isDefaultErrorMessage,
  isEncodedError,
} from './error-handler/index.js';

// exception
export {
  type IErrorOptions,
  type IExceptionRecord,
  Exception,
  isException,
} from './exception/index.js';
