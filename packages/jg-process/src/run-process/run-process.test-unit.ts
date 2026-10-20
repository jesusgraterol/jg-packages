import type * as ChildProcessModule from 'node:child_process';
import type * as ProcessTreeModule from '../process-tree/index.js';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Exception } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';

import { stopProcessTree } from '../process-tree/index.js';
import { ERRORS } from '../shared/index.js';
import { runProcess } from './run-process.js';

// replaces spawn, so a test controls the child's streams and events
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  spawn: vi.fn(),
}));

// keeps stopping the tree real, so a test can make it fail once
vi.mock('../process-tree/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof ProcessTreeModule>();
  return { ...actual, stopProcessTree: vi.fn(actual.stopProcessTree) };
});

// a child process whose streams the test writes to
type IFakeChild = ChildProcess & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough };

/**
 * Builds a child process without a pid, whose streams and events the test drives. Without a pid,
 * stopping its tree resolves at once.
 * @returns The child.
 */
const createFakeChild = (): IFakeChild => {
  const child = Object.assign(new EventEmitter(), {
    pid: undefined,
    exitCode: null,
    signalCode: null,
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
  vi.mocked(spawn).mockReturnValue(child as unknown as ChildProcess);
  return child as unknown as IFakeChild;
};

// an error the way Node.js reports a failed stream write
const streamError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`write ${code}`), { code });

afterEach(() => {
  vi.mocked(spawn).mockReset();
});

describe('runProcess stdin failures', () => {
  test('rejects with PROCESS_START_FAILED, keeping the error as the cause, when writing the input fails', async () => {
    const child = createFakeChild();
    const cause = streamError('EIO');

    const running = runProcess({ command: 'cat', args: [], input: 'data' });
    child.stdin.emit('error', cause);

    await expect(running).rejects.toMatchObject({
      code: ERRORS.PROCESS_START_FAILED,
      message: "Unable to start 'cat'.",
      cause,
    });
  });

  test('rejects with PROCESS_START_FAILED for a stdin error without a code', async () => {
    const child = createFakeChild();
    const cause = new Error('The stream failed.');

    const running = runProcess({ command: 'cat', args: [], input: 'data' });
    child.stdin.emit('error', cause);

    await expect(running).rejects.toMatchObject({ code: ERRORS.PROCESS_START_FAILED, cause });
  });

  test.each(['EPIPE', 'EOF', 'ERR_STREAM_DESTROYED'])(
    'ignores %s, from a child that stopped reading, and resolves with the exit',
    async (code) => {
      const child = createFakeChild();

      const running = runProcess({ command: 'head', args: ['-c', '1'], input: 'data' });
      child.stdin.emit('error', streamError(code));
      child.stdout.end('d');
      child.stderr.end();
      child.emit('exit', 0, null);
      child.emit('close', 0, null);

      await expect(running).resolves.toMatchObject({ exitCode: 0, stdout: 'd' });
    },
  );
});

describe('runProcess when the child cannot start', () => {
  test("rejects with the child's start error when its pipes fail too, as on Windows", async () => {
    const child = createFakeChild();
    const missing = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });

    const running = runProcess({ command: 'git', args: ['status'] });
    // Windows reports the pipes of a child that never started as not connected
    child.stdout.emit('error', streamError('ENOTCONN'));
    child.stderr.emit('error', streamError('ENOTCONN'));
    child.emit('error', missing);

    await expect(running).rejects.toMatchObject({
      code: ERRORS.PROCESS_START_FAILED,
      cause: missing,
    });
  });
});

describe('runProcess after the child exits', () => {
  test('waits for the output streams to close after the exit', async () => {
    const child = createFakeChild();

    const running = runProcess({ command: 'echo', args: ['done'] });
    child.stdout.end('done');
    child.stderr.end();
    child.emit('exit', 0, null);
    await new Promise((resolve) => setTimeout(resolve, 10));
    child.emit('close', 0, null);

    await expect(running).resolves.toMatchObject({ exitCode: 0, stdout: 'done' });
  });

  test('rejects with PROCESS_OUTPUT_TOO_LARGE for output that arrives after the exit', async () => {
    const child = createFakeChild();

    const running = runProcess({ command: 'yes', args: [], maxOutputBytes: 4 });
    child.emit('exit', 0, null);
    child.stdout.end('too much output');
    child.stderr.end();
    await new Promise((resolve) => setTimeout(resolve, 10));
    child.emit('close', 0, null);

    await expect(running).rejects.toMatchObject({ code: ERRORS.PROCESS_OUTPUT_TOO_LARGE });
  });

  test("rejects with the tree's error, and closes the child's streams, when stopping it fails", async () => {
    const child = createFakeChild();
    const survived = new Exception('The process tree is still running.', {
      code: ERRORS.PROCESS_TREE_SURVIVED,
    });
    vi.mocked(stopProcessTree).mockRejectedValueOnce(survived);

    const running = runProcess({ command: 'sleep', args: ['60'], timeoutSeconds: 0.01 });

    await expect(running).rejects.toBe(survived);
    expect(child.stdout.destroyed).toBe(true);
  });
});

describe('runProcess limits', () => {
  test.each([
    [{ timeoutSeconds: 0 }],
    [{ timeoutSeconds: -1 }],
    [{ timeoutSeconds: Number.NaN }],
    [{ timeoutSeconds: Number.POSITIVE_INFINITY }],
    [{ timeoutSeconds: 2_147_484 }],
    [{ maxOutputBytes: 0 }],
    [{ maxOutputBytes: -1 }],
    [{ maxOutputBytes: 1.5 }],
    [{ maxOutputBytes: Number.NaN }],
  ])('runProcess(%o) -> rejects with INVALID_PROCESS_OPTIONS before starting', async (limits) => {
    await expectToRejectCode(
      runProcess({ command: 'node', args: ['--version'], ...limits }),
      ERRORS.INVALID_PROCESS_OPTIONS,
    );
    expect(spawn).not.toHaveBeenCalled();
  });
});
