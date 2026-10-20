import { Exception } from 'jg-exception';
import type { IProcessResult } from 'jg-process';

import { ERRORS } from '../shared/index.js';
import { ACCESS_DENIED_PATTERN, REPOSITORY_NOT_FOUND_PATTERN } from './constants.js';

/**
 * Throws the error for a git command that exited with a code other than 0, classified from its
 * stderr, which runGit has Git write in English: `GIT_REPOSITORY_NOT_FOUND` when the directory
 * isn't in a repository, `GIT_ACCESS_DENIED` when Git refused the repository, for its ownership or
 * a file's permissions, and `GIT_COMMAND_FAILED` otherwise. The error's data holds the subcommand
 * and the exit code, never stderr, which can show a URL with credentials in it.
 * @param result The command's result, from runGit.
 * @param subcommand The git subcommand that ran, such as `rev-parse`.
 * @example
 * import { assertGitSucceeded, runGit } from 'jg-git-commands';
 *
 * const result = await runGit(['check-attr', '--stdin', '-z', 'text'], { cwd: '/srv/app', input: 'README.md\0' });
 * assertGitSucceeded(result, 'check-attr');
 * @throws
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 */
export const assertGitSucceeded = (
  result: IProcessResult<string | Buffer>,
  subcommand: string,
): void => {
  if (result.exitCode === 0) {
    return;
  }
  const stderr = typeof result.stderr === 'string' ? result.stderr : result.stderr.toString('utf8');
  const data = { subcommand, exitCode: result.exitCode };
  if (REPOSITORY_NOT_FOUND_PATTERN.test(stderr)) {
    throw new Exception("The directory isn't in a Git repository.", {
      code: ERRORS.GIT_REPOSITORY_NOT_FOUND,
      data,
    });
  }
  if (ACCESS_DENIED_PATTERN.test(stderr)) {
    throw new Exception("Git can't access the repository.", {
      code: ERRORS.GIT_ACCESS_DENIED,
      data,
    });
  }
  throw new Exception('The git command failed.', { code: ERRORS.GIT_COMMAND_FAILED, data });
};
