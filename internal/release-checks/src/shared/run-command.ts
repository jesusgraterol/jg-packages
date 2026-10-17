import { execFile } from 'node:child_process';

import type { ICommandResult, IRunCommand } from './types.ts';

// largest output a release command may print before it's stopped
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

/**
 * Runs an executable without a shell and resolves with its exit code and output, whatever the
 * exit code is, so callers decide which codes are failures.
 * @param executable The program to run, such as `npm` or `git`.
 * @param args Its arguments, passed as they are.
 * @param options The working directory and environment to run it with.
 * @returns A promise that resolves to the exit code, standard output, and standard error.
 * @throws
 * - Could not run {executable}: {message}
 */
export const runCommand: IRunCommand = (executable, args, options = {}) =>
  new Promise<ICommandResult>((resolvePromise, rejectPromise) => {
    execFile(
      executable,
      args,
      {
        cwd: options.cwd,
        env: options.env ?? process.env,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: 'utf8',
      },
      (error, stdout, stderr) => {
        if (error === null) {
          resolvePromise({ exitCode: 0, stdout, stderr });
          return;
        }
        if (typeof error.code === 'number') {
          resolvePromise({ exitCode: error.code, stdout, stderr });
          return;
        }
        rejectPromise(new Error(`Could not run ${executable}: ${error.message}`, { cause: error }));
      },
    );
  });
