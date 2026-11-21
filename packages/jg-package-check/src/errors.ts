import { Exception, extractMessage } from 'jg-exception';

// the stable codes for the package's own failures
export const ERRORS = {
  INVALID_NPM_TARBALL: 'INVALID_NPM_TARBALL',
  PACKED_CONSUMER_SETUP_FAILED: 'PACKED_CONSUMER_SETUP_FAILED',
  PACKED_CONSUMER_CLEANUP_FAILED: 'PACKED_CONSUMER_CLEANUP_FAILED',
} as const;

const MESSAGES = {
  INVALID_NPM_TARBALL: 'The npm tarball is invalid.',
  PACKED_CONSUMER_SETUP_FAILED: 'Unable to prepare the packed consumer.',
  PACKED_CONSUMER_CLEANUP_FAILED: 'Unable to remove the packed consumer.',
} as const;

/**
 * Retains the underlying diagnostic and, for cleanup failures, the exact owned directory.
 * @param code The package error code.
 * @param cause The original error.
 * @param directory The directory whose removal could not be confirmed.
 * @returns The coded error.
 */
export const packageCheckError = (
  code: keyof typeof ERRORS,
  cause: unknown,
  directory?: string,
): Exception =>
  new Exception(`${MESSAGES[code]}: ${extractMessage(cause)}`, {
    code,
    cause,
    data: directory === undefined ? null : { directory },
  });
