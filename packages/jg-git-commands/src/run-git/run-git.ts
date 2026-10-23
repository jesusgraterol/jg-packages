import { stat } from 'node:fs/promises';

import { Exception, getErrorCode } from 'jg-exception';
import {
  type IProcessOutput,
  type IProcessOutputEncoding,
  type IProcessResult,
  ERRORS as PROCESS_ERRORS,
  runProcess,
} from 'jg-process';

import { createGitEnvironment } from '../environment/index.js';
import { ERRORS, GIT_NULL_DEVICE, invalidArgument, isArgumentValid } from '../shared/index.js';
import {
  DEFAULT_GIT_MAX_OUTPUT_BYTES,
  DEFAULT_GIT_TIMEOUT_SECONDS,
  FIXED_CONFIG_ARGS,
  NO_CREDENTIAL_HELPERS_ARGS,
  WINDOWS_MAX_PATH,
} from './constants.js';
import type { IRunGitOptions } from './types.js';

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
 * Checks whether a variable the caller passes may be set: any but the ones that would let a
 * prompt through.
 * @param key The variable's name.
 * @returns Whether it may.
 */
const isCallerVariable = (key: string): boolean => {
  // Windows compares names without case
  const name = key.toUpperCase();
  return (
    name !== 'GIT_ASKPASS' &&
    name !== 'GIT_TERMINAL_PROMPT' &&
    name !== 'GCM_INTERACTIVE' &&
    !name.startsWith('SSH_ASKPASS')
  );
};

/**
 * Runs a git command that never prompts: without a terminal prompt or an askpass program, in an
 * environment without inherited Git variables, with an SSH command in batch mode, without a file
 * system monitor or a pager, and, unless `useCredentialHelpers`, without credential helpers, the
 * repository's included. A helper that does run can't prompt either: Git Credential Manager runs
 * with `GCM_INTERACTIVE=never`, so it fails rather than open a sign-in window. Without credential
 * helpers, authenticate with SSH keys or credentials you pass yourself, such as a header set as
 * config in `env`. It also runs without colors or
 * recursing into submodules, in the C locale, and allows no transport unless `env` sets
 * `GIT_ALLOW_PROTOCOL`, so reading a partial clone never fetches. It resolves with the exit code,
 * whatever it is, and the output, decoded as UTF-8 or as bytes with `encoding: 'buffer'`; a
 * timeout or too much output rejects as jg-process's runProcess does. `assertGitSucceeded` throws
 * the classified error for a failed command.
 * @param args The command's arguments, such as `['status', '--porcelain=v1']`.
 * @param options The working directory, the limits, and how much of the user's setup applies.
 * @returns A promise that resolves with the exit code and the output.
 * @example
 * import { runGit } from 'jg-git-commands';
 *
 * const { exitCode, stdout } = await runGit(['log', '-1', '--format=%H'], { cwd: '/srv/app' });
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const runGit = async <TEncoding extends IProcessOutputEncoding = 'utf-8'>(
  args: readonly string[],
  {
    cwd,
    timeoutSeconds = DEFAULT_GIT_TIMEOUT_SECONDS,
    maxOutputBytes = DEFAULT_GIT_MAX_OUTPUT_BYTES,
    input,
    signal,
    isolateConfig = false,
    useCredentialHelpers = false,
    env,
    encoding,
  }: IRunGitOptions<TEncoding>,
): Promise<IProcessResult<IProcessOutput<TEncoding>>> => {
  if (!areArgsValid(args)) {
    throw invalidArgument('args');
  }
  if (!isArgumentValid(cwd) || !(await isDirectory(cwd))) {
    throw invalidArgument('cwd');
  }
  // no askpass program, whatever the caller's variables say
  const gitEnv: NodeJS.ProcessEnv = {
    ...createGitEnvironment({ isolateConfig }),
    ...Object.fromEntries(Object.entries(env ?? {}).filter(([key]) => isCallerVariable(key))),
  };
  try {
    return await runProcess<TEncoding>({
      command: 'git',
      args: [
        ...FIXED_CONFIG_ARGS,
        ...(isolateConfig ? ['-c', `core.attributesFile=${GIT_NULL_DEVICE}`] : []),
        ...(useCredentialHelpers ? [] : NO_CREDENTIAL_HELPERS_ARGS),
        '--no-pager',
        ...args,
      ],
      cwd,
      env: gitEnv,
      timeoutSeconds,
      maxOutputBytes,
      ...(input === undefined ? {} : { input }),
      ...(signal === undefined ? {} : { signal }),
      ...(encoding === undefined ? {} : { encoding }),
    });
  } catch (error) {
    const isNotFound =
      getErrorCode(error) === PROCESS_ERRORS.PROCESS_START_FAILED &&
      getErrorCode((error as { cause?: unknown }).cause) === 'ENOENT';
    // Windows can report a working directory past its path limit as a missing program
    if (isNotFound && process.platform === 'win32' && cwd.length >= WINDOWS_MAX_PATH) {
      throw invalidArgument('cwd');
    }
    // the working directory exists, so a start that can't find a file means git is missing
    if (isNotFound) {
      throw new Exception("Git isn't installed, or isn't on the PATH.", {
        code: ERRORS.GIT_NOT_FOUND,
        cause: error,
      });
    }
    throw error;
  }
};
