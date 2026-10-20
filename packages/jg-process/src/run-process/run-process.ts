import { spawn, type ChildProcess } from 'node:child_process';
import { Exception } from 'jg-exception';

import { stopProcessTree } from '../process-tree/index.js';
import {
  DEFAULT_GRACE_PERIOD_SECONDS,
  DEFAULT_MAX_OUTPUT_BYTES,
  ERRORS,
  type IProcessOutput,
  type IProcessOutputEncoding,
  type IProcessResult,
  type IRunProcessOptions,
  MAX_TIMEOUT_SECONDS,
} from '../shared/index.js';

import type { IRunOutcome } from './types.js';
import { IGNORED_STDIN_ERROR_CODES } from './constants.js';

/**
 * Builds the error thrown when a command can't start or its input can't be written.
 * @param command The command that failed.
 * @param cause The underlying error.
 * @returns The error.
 */
const startFailed = (command: string, cause: unknown): Exception =>
  new Exception(`Unable to start '${command}'.`, {
    code: ERRORS.PROCESS_START_FAILED,
    cause,
  });

/**
 * Builds the error thrown when a process writes more output than allowed.
 * @param command The command that ran.
 * @param maxOutputBytes The allowed number of bytes.
 * @returns The error.
 */
const outputTooLarge = (command: string, maxOutputBytes: number): Exception =>
  new Exception(`The process '${command}' wrote more than ${maxOutputBytes} bytes of output.`, {
    code: ERRORS.PROCESS_OUTPUT_TOO_LARGE,
  });

/**
 * Ensures the run's limits are usable, such as a remaining budget a caller computed.
 * @param timeoutSeconds The timeout, when given.
 * @param maxOutputBytes The output limit.
 * @throws
 * - INVALID_PROCESS_OPTIONS: The timeout must be a positive number of at most 2,147,483 seconds, and the output limit a positive safe integer.
 */
const validateLimits = (timeoutSeconds: number | undefined, maxOutputBytes: number): void => {
  const isTimeoutValid =
    timeoutSeconds === undefined ||
    (typeof timeoutSeconds === 'number' &&
      Number.isFinite(timeoutSeconds) &&
      timeoutSeconds > 0 &&
      timeoutSeconds <= MAX_TIMEOUT_SECONDS);
  if (!isTimeoutValid || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new Exception(
      'The timeout must be a positive number of at most 2,147,483 seconds, and the output limit a positive safe integer.',
      {
        code: ERRORS.INVALID_PROCESS_OPTIONS,
        data: { timeoutSeconds: String(timeoutSeconds), maxOutputBytes: String(maxOutputBytes) },
      },
    );
  }
};

/**
 * Joins a stream's chunks, decoded as UTF-8 or kept as bytes.
 * @param chunks The chunks.
 * @param encoding How to return them.
 * @returns The output.
 */
const decodeOutput = (chunks: Buffer[], encoding: IProcessOutputEncoding): string | Buffer => {
  const output = Buffer.concat(chunks);
  return encoding === 'buffer' ? output : output.toString('utf-8');
};

/**
 * Destroys the child's stdio streams, so pipes held by an unreachable process can't keep the
 * caller's event loop alive.
 * @param child The child process.
 */
const destroyStdio = (child: ChildProcess): void => {
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
};

/**
 * Waits until the child's stdio streams have closed, for at most the provided time.
 * @param child The child process.
 * @param isClosed Whether the streams already closed.
 * @param milliseconds The maximum time to wait.
 * @returns A promise that resolves to whether the streams closed in time.
 */
const waitForClose = (
  child: ChildProcess,
  isClosed: () => boolean,
  milliseconds: number,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (isClosed()) {
      resolve(true);
      return;
    }
    const onClose = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off('close', onClose);
      resolve(false);
    }, milliseconds);
    child.once('close', onClose);
  });

/**
 * Stops a child's process tree, destroying its stdio streams when that fails.
 * @param child The child process.
 * @returns A promise that resolves once the tree is gone.
 * @throws
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped.
 */
const stopTree = async (child: ChildProcess): Promise<void> => {
  try {
    await stopProcessTree(child);
  } catch (error) {
    destroyStdio(child);
    throw error;
  }
};

/**
 * Runs a command to completion and resolves with its exit code, signal and output, decoded as UTF-8,
 * or as the bytes the process wrote with `encoding: 'buffer'`. It runs without a shell and, on
 * POSIX, as the leader of its own process group.
 *
 * Every exit resolves, whatever its code: callers decide which codes are acceptable, so process
 * output never ends up in an error message. The call rejects only when the command can't start,
 * the timeout passes, the output exceeds maxOutputBytes, or the signal aborts; in those cases the
 * process tree is stopped first, so the rejection can arrive up to the grace period plus two
 * seconds after the trigger.
 *
 * Input that the child never reads is discarded without an error. When the child exits,
 * descendants left in its process group are stopped. If one that couldn't be reached, such as a
 * descendant that left the group with setsid or one orphaned on Windows, keeps stdout or stderr
 * open for longer than the grace period, the call rejects instead of hanging.
 *
 * Because the child leads its own group, a terminal's Ctrl+C reaches only the parent: CLIs should
 * abort the signal when they receive SIGINT or SIGTERM.
 * @param options The command, its arguments, and the limits of the run.
 * @returns A promise that resolves with the exit code, the signal and the output.
 * @example
 * import { runProcess } from 'jg-process';
 *
 * const { exitCode, stdout } = await runProcess({ command: 'git', args: ['status', '--porcelain'], timeoutSeconds: 30 });
 * if (exitCode !== 0) {
 *   // handle the failure
 * }
 * @throws
 * - INVALID_PROCESS_OPTIONS: The timeout must be a positive number of at most 2,147,483 seconds, and the output limit a positive safe integer.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const runProcess = async <TEncoding extends IProcessOutputEncoding = 'utf-8'>(
  options: IRunProcessOptions<TEncoding>,
): Promise<IProcessResult<IProcessOutput<TEncoding>>> => {
  const {
    command,
    args,
    cwd,
    env,
    input,
    timeoutSeconds,
    maxOutputBytes = DEFAULT_MAX_OUTPUT_BYTES,
    signal,
    encoding = 'utf-8',
  } = options;
  validateLimits(timeoutSeconds, maxOutputBytes);
  signal?.throwIfAborted();
  const startedAt = performance.now();
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: 'pipe',
    detached: process.platform !== 'win32',
    windowsHide: true,
  });
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let outputBytes = 0;
  let isClosed = false;
  child.once('close', () => {
    isClosed = true;
  });

  // wait for the first of: exit, start failure, stdin failure, timeout, output overflow, abort
  const outcome = await new Promise<IRunOutcome>((resolve) => {
    let timer: NodeJS.Timeout | undefined;
    const onAbort = (): void => {
      clearTimeout(timer);
      resolve({ kind: 'failed', error: signal?.reason });
    };
    const settle = (value: IRunOutcome): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const collect = (chunks: Buffer[]) => (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes) {
        settle({ kind: 'failed', error: outputTooLarge(command, maxOutputBytes) });
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', (error) => settle({ kind: 'failed', error: startFailed(command, error) }));
    child.once('exit', (exitCode, signalCode) => settle({ kind: 'exited', exitCode, signalCode }));
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (!IGNORED_STDIN_ERROR_CODES.includes(error.code ?? '')) {
        settle({ kind: 'failed', error: startFailed(command, error) });
      }
    });
    if (timeoutSeconds !== undefined) {
      timer = setTimeout(
        () =>
          settle({
            kind: 'failed',
            error: new Exception(
              `The process '${command}' didn't finish within ${timeoutSeconds} seconds.`,
              { code: ERRORS.PROCESS_TIMED_OUT },
            ),
          }),
        timeoutSeconds * 1000,
      );
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    child.stdin.end(input);
  });

  // a failed run stops the whole tree before it rejects
  if (outcome.kind === 'failed') {
    await stopTree(child);
    destroyStdio(child);
    throw outcome.error;
  }

  // the child exited: stop the descendants left in its group, then wait for its output to close
  await stopTree(child);
  if (!(await waitForClose(child, () => isClosed, DEFAULT_GRACE_PERIOD_SECONDS * 1000))) {
    destroyStdio(child);
    throw new Exception(`A process started by '${command}' kept its output open after it exited.`, {
      code: ERRORS.PROCESS_TREE_SURVIVED,
    });
  }
  if (outputBytes > maxOutputBytes) {
    throw outputTooLarge(command, maxOutputBytes);
  }
  return {
    exitCode: outcome.exitCode,
    signalCode: outcome.signalCode,
    stdout: decodeOutput(stdout, encoding) as IProcessOutput<TEncoding>,
    stderr: decodeOutput(stderr, encoding) as IProcessOutput<TEncoding>,
    durationMs: Math.round(performance.now() - startedAt),
  };
};
