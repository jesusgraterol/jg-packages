// @vitest-environment node
import { PassThrough } from 'node:stream';

import { expectToRejectCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { readStream } from './read-stream.js';

describe('readStream', () => {
  test('resolves to every chunk, joined, at the end of the stream', async () => {
    const stream = new PassThrough();
    const reading = readStream(stream, { maxBytes: 8 });

    stream.write(Buffer.from('ab'));
    stream.end(Buffer.from('cd'));

    await expect(reading).resolves.toStrictEqual(Buffer.from('abcd'));
    expect(stream.listenerCount('data')).toBe(0);
  });

  test('takes content of exactly the limit', async () => {
    const stream = new PassThrough();
    const reading = readStream(stream, { maxBytes: 4 });

    stream.end(Buffer.from('abcd'));

    await expect(reading).resolves.toStrictEqual(Buffer.from('abcd'));
  });

  test('refuses one byte past the limit, and leaves the stream open and paused', async () => {
    const stream = new PassThrough();
    const reading = readStream(stream, { maxBytes: 4 });

    stream.write(Buffer.from('abcde'));

    await expectToRejectCode(reading, ERRORS.STREAM_TOO_LARGE, 'larger than 4 bytes');
    expect(stream.destroyed).toBe(false);
    expect(stream.isPaused()).toBe(true);
    expect(stream.listenerCount('data')).toBe(0);
  });

  test('counts text chunks by their bytes', async () => {
    const stream = new PassThrough();
    stream.setEncoding('utf8');
    const reading = readStream(stream, { maxBytes: 3 });

    // two characters, four bytes in UTF-8
    stream.write(Buffer.from('éé'));

    await expectToRejectCode(reading, ERRORS.STREAM_TOO_LARGE);
  });

  test("rejects with the signal's reason when it aborts, and leaves the stream open", async () => {
    const stream = new PassThrough();
    const controller = new AbortController();
    const reading = readStream(stream, { maxBytes: 8, signal: controller.signal });

    stream.write(Buffer.from('ab'));
    controller.abort('stopped');

    await expect(reading).rejects.toBe('stopped');
    expect(stream.destroyed).toBe(false);
    expect(stream.listenerCount('data')).toBe(0);
  });

  test('rejects at once for a signal that was already aborted', async () => {
    const stream = new PassThrough();

    await expect(
      readStream(stream, { maxBytes: 8, signal: AbortSignal.abort('stopped') }),
    ).rejects.toBe('stopped');
    expect(stream.listenerCount('data')).toBe(0);
  });

  test("rejects with the stream's own error", async () => {
    const stream = new PassThrough();
    const failure = new Error('read failed');
    const reading = readStream(stream, { maxBytes: 8 });

    stream.destroy(failure);

    await expect(reading).rejects.toBe(failure);
  });

  test.each([[0], [-1], [1.5], [Number.NaN], [Number.MAX_SAFE_INTEGER + 1]])(
    'readStream({ maxBytes: %d }) -> rejects with INVALID_PROCESS_OPTIONS',
    async (maxBytes) => {
      await expectToRejectCode(
        readStream(new PassThrough(), { maxBytes }),
        ERRORS.INVALID_PROCESS_OPTIONS,
      );
    },
  );
});
