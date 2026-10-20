// @vitest-environment node
import { PassThrough } from 'node:stream';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { readStdin } from './stdin.js';

// stands in for process.stdin, which the test runner's worker doesn't feed
let stdin: PassThrough;

beforeEach(() => {
  stdin = new PassThrough();
  vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin as unknown as typeof process.stdin);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readStdin', () => {
  test('resolves to every chunk, joined, at the end of stdin', async () => {
    const reading = readStdin({ maxBytes: 8 });

    stdin.write(Buffer.from('ab'));
    stdin.end(Buffer.from('cd'));

    await expect(reading).resolves.toStrictEqual(Buffer.from('abcd'));
    expect(stdin.listenerCount('data')).toBe(0);
  });

  test('rejects with STDIN_TOO_LARGE past the limit, and destroys stdin', async () => {
    const reading = readStdin({ maxBytes: 3 });

    stdin.write(Buffer.from('abcd'));

    await expectToRejectCode(reading, ERRORS.STDIN_TOO_LARGE);
    expect(stdin.destroyed).toBe(true);
  });

  test("rejects with the signal's reason when it aborts, and destroys stdin", async () => {
    const controller = new AbortController();
    const reading = readStdin({ maxBytes: 8, signal: controller.signal });

    controller.abort('stopped');

    await expect(reading).rejects.toBe('stopped');
    expect(stdin.destroyed).toBe(true);
  });

  test('rejects at once for a signal that was already aborted', async () => {
    await expect(readStdin({ maxBytes: 8, signal: AbortSignal.abort('stopped') })).rejects.toBe(
      'stopped',
    );
    expect(stdin.destroyed).toBe(true);
  });

  test("rejects with stdin's own error", async () => {
    const failure = new Error('read failed');
    const reading = readStdin({ maxBytes: 8 });

    stdin.destroy(failure);

    await expect(reading).rejects.toBe(failure);
  });

  test.each([[0], [-1], [1.5], [Number.NaN]])(
    'readStdin({ maxBytes: %d }) -> rejects with INVALID_PROCESS_OPTIONS',
    async (maxBytes) => {
      await expectToRejectCode(readStdin({ maxBytes }), ERRORS.INVALID_PROCESS_OPTIONS);
    },
  );
});
