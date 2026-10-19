import { stat } from 'node:fs/promises';

import { Exception, getErrorCode } from 'jg-exception';
import { ERRORS as PROCESS_ERRORS, type IProcessResult, runProcess } from 'jg-process';

import { ERRORS, invalidArgument, isArgumentValid } from '../shared/index.js';
import { DEFAULT_DOCKER_MAX_OUTPUT_BYTES, DEFAULT_DOCKER_TIMEOUT_SECONDS } from './constants.js';
import type { IRunDockerOptions } from './types.js';

/**
 * Checks whether a path is a directory that exists.
 * @param path The path.
 * @returns A promise that resolves to whether it is.
 */
const isDirectory = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
};

/**
 * Checks whether a command's arguments are strings without a null character, which a process
 * argument can't hold.
 * @param args The arguments.
 * @returns Whether they are.
 */
const areArgsValid = (args: unknown): boolean =>
  Array.isArray(args) &&
  args.every((arg: unknown) => typeof arg === 'string' && !arg.includes('\0'));

/**
 * Runs a docker command without a shell, within a timeout and an output limit. With `host`, it
 * passes `--host` first, so the command goes to that endpoint even when the current context
 * changes after the endpoint was checked. It resolves with the exit code, whatever it is, and the
 * output decoded as UTF-8; a timeout or too much output rejects as jg-process's runProcess does.
 * @param args The command's arguments, such as `['ps', '--format', 'json']`.
 * @param options The endpoint, the working directory, the environment, and the limits.
 * @returns A promise that resolves with the exit code and the output.
 * @example
 * import { resolveLocalDockerHost, runDocker } from 'jg-local-docker';
 *
 * const host = await resolveLocalDockerHost();
 * const { exitCode, stdout } = await runDocker(['volume', 'ls', '--quiet'], { host });
 * @throws
 * - DOCKER_INVALID_ARGUMENT: An argument isn't valid.
 * - DOCKER_NOT_FOUND: Docker isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const runDocker = async (
  args: readonly string[],
  {
    host,
    cwd,
    env,
    timeoutSeconds = DEFAULT_DOCKER_TIMEOUT_SECONDS,
    maxOutputBytes = DEFAULT_DOCKER_MAX_OUTPUT_BYTES,
    signal,
  }: IRunDockerOptions = {},
): Promise<IProcessResult> => {
  if (!areArgsValid(args)) {
    throw invalidArgument('args');
  }
  if (host !== undefined && !isArgumentValid(host)) {
    throw invalidArgument('host');
  }
  if (cwd !== undefined && !(typeof cwd === 'string' && cwd !== '' && (await isDirectory(cwd)))) {
    throw invalidArgument('cwd');
  }
  try {
    return await runProcess({
      command: 'docker',
      args: [...(host === undefined ? [] : ['--host', host]), ...args],
      timeoutSeconds,
      maxOutputBytes,
      ...(cwd === undefined ? {} : { cwd }),
      ...(env === undefined ? {} : { env }),
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    // the working directory exists, so a start that can't find a file means docker is missing
    if (
      getErrorCode(error) === PROCESS_ERRORS.PROCESS_START_FAILED &&
      error instanceof Exception &&
      getErrorCode(error.cause) === 'ENOENT'
    ) {
      throw new Exception("Docker isn't installed, or isn't on the PATH.", {
        code: ERRORS.DOCKER_NOT_FOUND,
        cause: error,
      });
    }
    throw error;
  }
};
