import type { Readable } from 'node:stream';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { IReadStreamOptions } from './types.js';
import { readBoundedStream } from './utilities.js';

/**
 * Reads a stream to its end, such as a request body or a socket's message, into one buffer. It
 * refuses more than `maxBytes` the moment the content passes the limit, and stops when the signal
 * aborts. A refused or stopped read leaves the stream open and paused, so its owner can still
 * answer, such as with a 413, before it closes the stream. Start reading before the stream ends.
 * @param stream The stream, which isn't in object mode.
 * @param options The byte limit, and the signal that stops the read.
 * @returns A promise that resolves to the stream's bytes.
 * @example
 * import { createServer } from 'node:http';
 * import { readStream } from 'jg-process';
 *
 * createServer(async (request, response) => {
 *   const body = await readStream(request, { maxBytes: 65_536 }); // STREAM_TOO_LARGE past 64 KiB
 *   response.end(body);
 * });
 * @throws
 * - INVALID_PROCESS_OPTIONS: The stream limit must be a positive safe integer.
 * - STREAM_TOO_LARGE: The stream is larger than `maxBytes` bytes.
 * - The stream's own error, unchanged.
 * - The signal's reason when the signal aborts.
 */
export const readStream = (
  stream: Readable,
  { maxBytes, signal }: IReadStreamOptions,
): Promise<Buffer> =>
  readBoundedStream(stream, {
    maxBytes,
    signal,
    isDestroyedOnFailure: false,
    invalidLimit: () =>
      new Exception('The stream limit must be a positive safe integer.', {
        code: ERRORS.INVALID_PROCESS_OPTIONS,
        data: { maxBytes: String(maxBytes) },
      }),
    tooLarge: () =>
      new Exception(`The stream is larger than ${maxBytes} bytes.`, {
        code: ERRORS.STREAM_TOO_LARGE,
        data: { maxBytes },
      }),
  });
