import type * as ChildProcessModule from 'node:child_process';
import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { runProcess } from './run-process.js';

// replaces spawn, so a test controls the child's streams and events
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  spawn: vi.fn(),
}));

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
