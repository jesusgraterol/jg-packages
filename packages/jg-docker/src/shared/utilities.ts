import { Exception } from 'jg-exception';
import type { IProcessResult } from 'jg-process';

import { ERRORS } from './errors.js';

/**
 * Builds the exception for an argument that isn't valid.
 * @param name The argument, such as `host`.
 * @returns The DOCKER_INVALID_ARGUMENT exception.
 */
export const invalidArgument = (name: string): Exception =>
  new Exception("An argument isn't valid.", {
    code: ERRORS.DOCKER_INVALID_ARGUMENT,
    data: { argument: name },
  });

/**
 * Builds the exception for output that isn't in the expected format.
 * @param subcommand The docker subcommand that wrote it, such as `compose ps`.
 * @returns The DOCKER_OUTPUT_INVALID exception.
 */
export const invalidOutput = (subcommand: string): Exception =>
  new Exception("Docker's output isn't in the expected format.", {
    code: ERRORS.DOCKER_OUTPUT_INVALID,
    data: { subcommand },
  });

/**
 * Gives a command's stdout when it exited with 0.
 * @param result The command's result.
 * @param subcommand The docker subcommand that ran, such as `compose ps`.
 * @returns The stdout.
 * @throws
 * - DOCKER_COMMAND_FAILED: The docker command failed.
 */
export const readSuccessfulOutput = (result: IProcessResult, subcommand: string): string => {
  if (result.exitCode !== 0) {
    // stderr stays out, because Compose's diagnostics can quote the project's configuration
    throw new Exception('The docker command failed.', {
      code: ERRORS.DOCKER_COMMAND_FAILED,
      data: { subcommand, exitCode: result.exitCode },
    });
  }
  return result.stdout;
};

/**
 * Checks whether a value is a non-empty string that can't read as an option, which Docker can
 * take as an argument.
 * @param value The value.
 * @returns Whether it is.
 */
export const isArgumentValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !value.startsWith('-') && !value.includes('\0');

/**
 * Checks whether a value is a plain object, such as one parsed from JSON.
 * @param value The value.
 * @returns Whether it is.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
