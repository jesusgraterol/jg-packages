import type { IErrorCodeWrapper } from './types.js';

// the delimiters an encoded error wraps its code in: `message{(code)}`
export const CODE_WRAPPER: IErrorCodeWrapper = {
  prefix: '{(',
  suffix: ')}',
};

// the message used when none can be extracted from an error
export const DEFAULT_MESSAGE =
  'The error message could not be extracted, check the logs for more information.';

// the code used when an error has none, or none can be extracted
export const DEFAULT_CODE = '-1';
