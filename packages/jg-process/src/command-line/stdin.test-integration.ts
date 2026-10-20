// @vitest-environment node
import { spawn } from 'node:child_process';

import { describe, expect, test } from 'vitest';

// the built package, which the child imports as an app would
const DIST_URL = new URL('../../dist/index.js', import.meta.url).href;

/**
 * Runs a child that reads its stdin with readStdin and prints the outcome.
 * @param options The source of readStdin's options.
 * @param input What to write to the child's stdin, or null to leave it open.
 * @returns A promise that resolves to the child's output.
 */
const runReader = (options: string, input: Buffer | null): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { readStdin } from ${JSON.stringify(DIST_URL)};
        try {
          const bytes = await readStdin(${options});
          process.stdout.write('read ' + bytes.length + ' ' + bytes.subarray(0, 8).toString('hex'));
        } catch (error) {
          const label = typeof error === 'string' ? error : typeof error.code === 'string' ? error.code : error.name;
          process.stdout.write('failed ' + label + ' ' + process.stdin.destroyed);
        }`,
      ],
      { stdio: ['pipe', 'pipe', 'inherit'] },
    );
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
    });
    child.once('error', reject);
    child.once('exit', () => {
      resolve(output);
    });
    // a child that stopped reading closes the pipe, which this write mustn't treat as an error
    child.stdin.on('error', () => undefined);
    if (input !== null) {
      child.stdin.end(input);
    }
  });

describe('readStdin', () => {
  test('reads stdin to its end', async () => {
    await expect(
      runReader('{ maxBytes: 16 }', Buffer.from([0xde, 0xad, 0xbe, 0xef])),
    ).resolves.toBe('read 4 deadbeef');
  });

  test('reads an input exactly as large as the limit, and an empty one', async () => {
    await expect(runReader('{ maxBytes: 4 }', Buffer.from('abcd'))).resolves.toBe(
      'read 4 61626364',
    );
    await expect(runReader('{ maxBytes: 4 }', Buffer.alloc(0))).resolves.toBe('read 0 ');
  });

  test('throws STDIN_TOO_LARGE past the limit, and destroys stdin', async () => {
    await expect(runReader('{ maxBytes: 4 }', Buffer.from('abcde'))).resolves.toBe(
      'failed STDIN_TOO_LARGE true',
    );
  });

  test("rejects with the signal's reason when it aborts, and destroys stdin", async () => {
    await expect(
      runReader('{ maxBytes: 16, signal: AbortSignal.timeout(100) }', null),
    ).resolves.toBe('failed TimeoutError true');
  });

  test('rejects at once for a signal that was already aborted', async () => {
    await expect(
      runReader("{ maxBytes: 16, signal: AbortSignal.abort('stopped') }", null),
    ).resolves.toBe('failed stopped true');
  });

  test('throws INVALID_PROCESS_OPTIONS for a limit that is not a positive safe integer', async () => {
    await expect(runReader('{ maxBytes: 0 }', Buffer.from('a'))).resolves.toBe(
      'failed INVALID_PROCESS_OPTIONS false',
    );
  });
});
