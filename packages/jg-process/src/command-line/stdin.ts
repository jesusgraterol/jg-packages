import { Exception } from 'jg-exception';

import { readBoundedStream } from '../read-stream/utilities.js';
import { ERRORS } from '../shared/index.js';

import type { IReadStdinOptions } from './types.js';

/**
 * Reads the process's stdin to its end, such as the input a CLI is piped. It refuses more than
 * `maxBytes`, destroying stdin once the input passes the limit, and stops when the signal aborts.
 * @param options The byte limit, and the signal that stops the read.
 * @returns A promise that resolves to the bytes stdin held.
 * @example
 * import { readStdin } from 'jg-process';
 *
 * const input = (await readStdin({ maxBytes: 1_048_576 })).toString('utf8');
 * @throws
 * - INVALID_PROCESS_OPTIONS: The stdin limit must be a positive safe integer.
 * - STDIN_TOO_LARGE: stdin held more than `maxBytes`
 * - The signal's reason when the signal aborts.
 */
export const readStdin = ({ maxBytes, signal }: IReadStdinOptions): Promise<Buffer> =>
  readBoundedStream(process.stdin, {
    maxBytes,
    signal,
    isDestroyedOnFailure: true,
    invalidLimit: () =>
      new Exception('The stdin limit must be a positive safe integer.', {
        code: ERRORS.INVALID_PROCESS_OPTIONS,
        data: { maxBytes: String(maxBytes) },
      }),
    tooLarge: () =>
      new Exception(`The input on stdin is larger than ${maxBytes} bytes.`, {
        code: ERRORS.STDIN_TOO_LARGE,
        data: { maxBytes },
      }),
  });
