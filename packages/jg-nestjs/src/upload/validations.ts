import { Exception } from 'jg-exception';

import { ERROR_MESSAGES, ERRORS } from '../shared/index.js';
import { MAX_UPLOAD_TIMEOUT_SECONDS } from './constants.js';
import type { IUploadInterceptorOptions } from './types.js';

/**
 * Checks the upload options: a field name, a byte limit and a number of slots that are positive
 * safe integers, and a timeout of more than 0 and at most MAX_UPLOAD_TIMEOUT_SECONDS. A limit
 * that isn't a number, such as one read from a missing variable, would otherwise turn multer's
 * limit off.
 * @param options The options.
 * @throws
 * - INVALID_UPLOAD_OPTIONS: The upload options are invalid.
 */
export const assertUploadOptions = ({
  field,
  maxBytes,
  maxConcurrent,
  uploadTimeoutSeconds,
}: IUploadInterceptorOptions): void => {
  const isPositiveInteger = (value: unknown): boolean =>
    Number.isSafeInteger(value) && (value as number) > 0;
  const invalidOption =
    typeof field !== 'string' || field.length === 0
      ? 'field'
      : !isPositiveInteger(maxBytes)
        ? 'maxBytes'
        : !isPositiveInteger(maxConcurrent)
          ? 'maxConcurrent'
          : typeof uploadTimeoutSeconds !== 'number' ||
              !(uploadTimeoutSeconds > 0 && uploadTimeoutSeconds <= MAX_UPLOAD_TIMEOUT_SECONDS)
            ? 'uploadTimeoutSeconds'
            : undefined;
  if (invalidOption !== undefined) {
    throw new Exception(ERROR_MESSAGES.INVALID_UPLOAD_OPTIONS, {
      code: ERRORS.INVALID_UPLOAD_OPTIONS,
      data: { option: invalidOption },
    });
  }
};
