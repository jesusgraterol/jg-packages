import type { Readable } from 'node:stream';

import type { IBoundedReadOptions } from './types.js';

/**
 * Reads a stream to its end, refusing more than `maxBytes` and stopping when the signal aborts.
 * A failure removes the read's listeners and destroys the stream, or pauses it for its owner.
 * @param stream The stream.
 * @param options The limit, the signal, the errors to reject with, and what a failure does.
 * @returns A promise that resolves to the stream's bytes.
 */
export const readBoundedStream = (
  stream: Readable,
  { maxBytes, signal, invalidLimit, tooLarge, isDestroyedOnFailure }: IBoundedReadOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      reject(invalidLimit());
      return;
    }
    const chunks: Buffer[] = [];
    let byteLength = 0;
    const cleanUp = (): void => {
      stream.off('data', onData);
      stream.off('end', onEnd);
      stream.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (error: unknown): void => {
      cleanUp();
      if (isDestroyedOnFailure) stream.destroy();
      else stream.pause();
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- rejects with the signal's reason, as native APIs do
      reject(error);
    };
    const onData = (chunk: Buffer | string): void => {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      byteLength += bytes.length;
      if (byteLength > maxBytes) {
        fail(tooLarge());
        return;
      }
      chunks.push(bytes);
    };
    const onEnd = (): void => {
      cleanUp();
      resolve(Buffer.concat(chunks, byteLength));
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
    stream.on('data', onData);
    stream.once('end', onEnd);
    stream.once('error', onError);
  });
