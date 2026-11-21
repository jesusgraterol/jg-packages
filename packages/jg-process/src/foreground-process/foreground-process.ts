import { spawn, type ChildProcess } from 'node:child_process';

import { processStartFailed } from '../shared/index.js';

import type { IForegroundProcessOptions, IForegroundProcessResult } from './types.js';

/**
 * Runs a command without a shell, inheriting all three standard streams in the caller's process
 * group. The terminal handles interrupts for the group. The caller retains its own signal policy.
 * @param command The executable to run.
 * @param args The arguments passed to the executable.
 * @param options The optional working directory and environment.
 * @returns A promise that resolves to the child's exit code and signal after it closes.
 * @example
 * import { runForegroundProcess } from 'jg-process';
 *
 * const { exitCode, signalCode } = await runForegroundProcess('npm', ['--version']);
 * @throws
 * - PROCESS_START_FAILED: Unable to start '<command>'.
 */
export const runForegroundProcess = (
  command: string,
  args: string[],
  { cwd, env }: IForegroundProcessOptions = {},
): Promise<IForegroundProcessResult> =>
  new Promise((resolve, reject) => {
    let child: ChildProcess;
    try {
      child = spawn(command, args, { cwd, env, stdio: 'inherit', detached: false, shell: false });
    } catch (error) {
      reject(processStartFailed(command, error));
      return;
    }
    child.once('error', (error) => {
      reject(processStartFailed(command, error));
    });
    child.once('close', (exitCode, signalCode) => {
      resolve({ exitCode, signalCode });
    });
  });
