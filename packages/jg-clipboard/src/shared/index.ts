// errors
export { ERRORS } from './errors.js';
export {
  isCancellation,
  operationFailed,
  toClipboardException,
  unsupported,
} from './exceptions.js';

// types
export type {
  IClipboardContent,
  IClipboardOperation,
  IClipboardSupport,
  ICopyHtmlOptions,
} from './types.js';

// globals
export { browserGlobals, getSecureClipboard, supportsItemType } from './globals.js';
