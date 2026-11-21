import { Exception } from 'jg-exception';

import { ERRORS } from './errors.js';

/**
 * Builds the existing error for a command that could not be started.
 * @param command The command that failed.
 * @param cause The underlying error.
 * @returns The error with its cause preserved.
 */
export const processStartFailed = (command: string, cause: unknown): Exception =>
  new Exception(`Unable to start '${command}'.`, { code: ERRORS.PROCESS_START_FAILED, cause });
