// @vitest-environment node
import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { readResponseBytes } from './response.js';

/**
 * Builds a body that streams the chunks, and records whether it was cancelled.
 * @param chunks The chunks.
 * @returns The stream and the cancel spy.
 */
const streamOf = (chunks: number[][]) => {
  const cancel = vi.fn();
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull: (controller) => {
      const chunk = chunks[index];
      index += 1;
      if (chunk === undefined) {
        controller.close();
      } else {
        controller.enqueue(new Uint8Array(chunk));
      }
    },
    cancel,
  });
  return { stream, cancel, readCount: () => index };
};

describe('readResponseBytes', () => {
  test('reads every chunk, including a body exactly as large as the limit', async () => {
    const { stream } = streamOf([
      [1, 2],
      [3, 4],
    ]);

    await expect(readResponseBytes(new Response(stream), 4)).resolves.toStrictEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  test('reads a response without a body as no bytes', async () => {
    await expect(readResponseBytes(new Response(null, { status: 204 }), 4)).resolves.toStrictEqual(
      new Uint8Array(0),
    );
  });

  test('refuses at once a body whose content-length is over the limit, cancelling it', async () => {
    const { stream, cancel, readCount } = streamOf([[1, 2, 3, 4, 5]]);
    const response = new Response(stream, { headers: { 'content-length': '5' } });

    await expectToRejectCode(readResponseBytes(response, 4), ERRORS.RESPONSE_TOO_LARGE);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(readCount()).toBeLessThanOrEqual(1);
  });

  test('stops a streamed body as soon as it passes the limit, cancelling the rest', async () => {
    const { stream, cancel, readCount } = streamOf([[1, 2], [3, 4], [5], [6], [7]]);

    const error = await readResponseBytes(new Response(stream, { status: 200 }), 4).catch(
      (failure: unknown) => failure,
    );

    expect(error).toMatchObject({
      code: ERRORS.RESPONSE_TOO_LARGE,
      data: { maxBytes: 4, status: 200 },
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(readCount()).toBeLessThan(5);
  });

  test('unlocks the body once it cancels a read past the limit', async () => {
    const { stream } = streamOf([[1, 2], [3, 4], [5]]);
    const response = new Response(stream);

    await expectToRejectCode(readResponseBytes(response, 4), ERRORS.RESPONSE_TOO_LARGE);

    expect(response.body?.locked).toBe(false);
    await expect(response.body?.cancel()).resolves.toBeUndefined();
  });

  test('unlocks the body when its stream fails, as an aborted fetch fails it', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    let pulls = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull: (controller) => {
          pulls += 1;
          if (pulls === 1) {
            controller.enqueue(new Uint8Array([1]));
          } else {
            controller.error(abort);
          }
        },
      }),
    );

    await expect(readResponseBytes(response, 4)).rejects.toBe(abort);

    expect(response.body?.locked).toBe(false);
  });

  test.each([[0], [-1], [1.5], [Number.NaN]])(
    'readResponseBytes(response, %d) -> rejects with INVALID_OPTIONS',
    async (maxBytes) => {
      await expectToRejectCode(
        readResponseBytes(new Response('body'), maxBytes),
        ERRORS.INVALID_OPTIONS,
      );
    },
  );
});
