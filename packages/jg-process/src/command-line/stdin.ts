import { Exception } from 'jg-exception';

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
  new Promise((resolve, reject) => {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      reject(
        new Exception('The stdin limit must be a positive safe integer.', {
          code: ERRORS.INVALID_PROCESS_OPTIONS,
          data: { maxBytes: String(maxBytes) },
        }),
      );
      return;
    }
    const { stdin } = process;
    const chunks: Buffer[] = [];
    let byteLength = 0;
    const cleanUp = (): void => {
      stdin.off('data', onData);
      stdin.off('end', onEnd);
      stdin.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error: unknown): void => {
      cleanUp();
      stdin.destroy();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(error);
    };
    const onData = (chunk: Buffer): void => {
      byteLength += chunk.length;
      if (byteLength > maxBytes) {
        fail(
          new Exception(`The input on stdin is larger than ${maxBytes} bytes.`, {
            code: ERRORS.STDIN_TOO_LARGE,
            data: { maxBytes },
          }),
        );
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = (): void => {
      cleanUp();
      resolve(Buffer.concat(chunks));
    };
    const onError = (error: Error): void => {
      fail(error);
    };
    const onAbort = (): void => {
      fail(signal?.reason);
    };
    if (signal?.aborted) {
      fail(signal.reason);
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    stdin.on('data', onData);
    stdin.once('end', onEnd);
    stdin.once('error', onError);
  });
