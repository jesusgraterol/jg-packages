import { devNull } from 'node:os';

import { DEFAULT_GIT_MAX_OUTPUT_BYTES, runGit } from '../run-git/index.js';
import { invalidArgument, invalidOutput, isArgumentValid, isObjectId } from '../shared/index.js';
import type {
  IFetchCommitOptions,
  IGitCommandOptions,
  IReadFileAtRevisionOptions,
  IStatusEntry,
} from './types.js';
import {
  isRefName,
  isRepositoryPathValid,
  isRevisionValid,
  parseRemoteRefs,
  parseStatus,
  readSuccessfulOutput,
} from './utilities.js';

/**
 * Resolves a revision, such as a branch, a tag, or an abbreviated object ID, to the full object ID
 * of the commit it names. It reads objects without running anything from the repository's config.
 * @param cwd The repository's directory.
 * @param rev The revision.
 * @param options runGit's options, such as the timeout.
 * @returns A promise that resolves to the commit's object ID.
 * @example
 * import { resolveCommit } from 'jg-git';
 *
 * const commit = await resolveCommit('/srv/app', 'HEAD');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const resolveCommit = async (
  cwd: string,
  rev: string,
  options: IGitCommandOptions = {},
): Promise<string> => {
  if (!isArgumentValid(rev)) {
    throw invalidArgument('rev');
  }
  const output = readSuccessfulOutput(
    await runGit(['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`], {
      ...options,
      cwd,
    }),
    'rev-parse',
  );
  const objectId = output.trim();
  if (!isObjectId(objectId)) {
    throw invalidOutput('rev-parse');
  }
  return objectId;
};

/**
 * Reads the object ID of each ref asked for from a remote, a configured remote's name or a URL,
 * with `git ls-remote --refs`. A ref the remote doesn't have is missing from the map. With a
 * remote's name, Git runs the `remote.<name>.uploadpack` command its config names over the file
 * transport.
 * @param cwd The repository's directory.
 * @param remote The remote's name, such as `origin`, or its URL.
 * @param refs The full ref names, such as `refs/heads/main`.
 * @param options runGit's options, such as `useCredentialHelpers` for an authenticated remote.
 * @returns A promise that resolves to the object ID of each ref found.
 * @example
 * import { readRemoteRefs } from 'jg-git';
 *
 * const refs = await readRemoteRefs('/srv/app', 'origin', ['refs/heads/main', 'refs/tags/v1.0.0']);
 * const main = refs.get('refs/heads/main'); // the commit's object ID, or undefined
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readRemoteRefs = async (
  cwd: string,
  remote: string,
  refs: readonly string[],
  options: IGitCommandOptions = {},
): Promise<Map<string, string>> => {
  if (!isArgumentValid(remote)) {
    throw invalidArgument('remote');
  }
  if (!Array.isArray(refs) || refs.length === 0 || !refs.every(isRefName)) {
    throw invalidArgument('refs');
  }
  const output = readSuccessfulOutput(
    await runGit(['ls-remote', '--refs', '--end-of-options', remote, ...refs], {
      ...options,
      cwd,
    }),
    'ls-remote',
  );
  return parseRemoteRefs(output, refs);
};

/**
 * Reads a remote's URL, with the config's `url.<base>.insteadOf` rewrites applied.
 * @param cwd The repository's directory.
 * @param name The remote's name. Defaults to `origin`.
 * @param options runGit's options, such as the timeout.
 * @returns A promise that resolves to the URL.
 * @example
 * import { getRemoteUrl } from 'jg-git';
 *
 * const url = await getRemoteUrl('/srv/app');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const getRemoteUrl = async (
  cwd: string,
  name = 'origin',
  options: IGitCommandOptions = {},
): Promise<string> => {
  if (!isArgumentValid(name)) {
    throw invalidArgument('name');
  }
  const output = readSuccessfulOutput(
    await runGit(['remote', 'get-url', '--end-of-options', name], { ...options, cwd }),
    'remote',
  );
  const url = output.trim();
  if (url === '' || url.includes('\n')) {
    throw invalidOutput('remote');
  }
  return url;
};

/**
 * Reads the working tree's status with `git status --porcelain=v1 -z`: the changed paths, staged
 * or not, renames with their original paths, and untracked files, an untracked directory as one
 * entry. Git runs the clean filters that `.gitattributes` and the config name while it compares
 * files.
 * @param cwd The repository's directory.
 * @param options runGit's options, such as the output limit.
 * @returns A promise that resolves to the entries, empty for a clean working tree.
 * @example
 * import { readStatus } from 'jg-git';
 *
 * const renamed = (await readStatus('/srv/app')).filter(({ index }) => index === 'R');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readStatus = async (
  cwd: string,
  options: IGitCommandOptions = {},
): Promise<IStatusEntry[]> =>
  parseStatus(
    readSuccessfulOutput(
      await runGit(['status', '--porcelain=v1', '-z', '--untracked-files=normal'], {
        ...options,
        cwd,
      }),
      'status',
    ),
  );

/**
 * Checks whether the working tree has no changes, staged or not, and no untracked files that
 * aren't ignored.
 * @param cwd The repository's directory.
 * @param options runGit's options, such as the output limit.
 * @returns A promise that resolves to whether it's clean.
 * @example
 * import { isWorkingTreeClean } from 'jg-git';
 *
 * if (!(await isWorkingTreeClean('/srv/app'))) {
 *   // commit or stash the changes first
 * }
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const isWorkingTreeClean = async (
  cwd: string,
  options: IGitCommandOptions = {},
): Promise<boolean> => (await readStatus(cwd, options)).length === 0;

/**
 * Reads a file as UTF-8 text at a revision, with `git cat-file blob <rev>:<path>`, without
 * checking it out and without running anything from the repository's config.
 * @param cwd The repository's directory.
 * @param rev The revision, such as a commit's object ID.
 * @param path The file's path from the repository's root, such as `package.json`.
 * @param options The file's size limit, and runGit's options.
 * @returns A promise that resolves to the file's text.
 * @example
 * import { readFileAtRevision } from 'jg-git';
 *
 * const manifest = await readFileAtRevision('/srv/app', 'HEAD', 'package.json', { maxBytes: 65_536 });
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readFileAtRevision = async (
  cwd: string,
  rev: string,
  path: string,
  { maxBytes = DEFAULT_GIT_MAX_OUTPUT_BYTES, ...options }: IReadFileAtRevisionOptions = {},
): Promise<string> => {
  if (!isRevisionValid(rev)) {
    throw invalidArgument('rev');
  }
  if (!isRepositoryPathValid(path)) {
    throw invalidArgument('path');
  }
  return readSuccessfulOutput(
    await runGit(['cat-file', 'blob', '--end-of-options', `${rev}:${path}`], {
      ...options,
      cwd,
      maxOutputBytes: maxBytes,
    }),
    'cat-file',
  );
};

/**
 * Fetches a commit by its object ID from a URL into a repository, with only the history `depth`
 * asks for, and without tags, submodules, hooks, automatic maintenance, or writing `FETCH_HEAD`.
 * Read it afterwards by its object ID, such as with readFileAtRevision. The remote must allow
 * fetching a commit by its object ID, as GitHub does.
 * @param cwd The repository's directory, such as a bare one made for the fetch.
 * @param url The remote's URL.
 * @param objectId The commit's full object ID.
 * @param options The history's depth, and runGit's options.
 * @returns A promise that resolves once the commit is fetched.
 * @example
 * import { fetchCommit } from 'jg-git';
 *
 * await fetchCommit('/srv/cache/app.git', 'https://github.com/jesusgraterol/jg-packages.git', 'a'.repeat(40));
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const fetchCommit = async (
  cwd: string,
  url: string,
  objectId: string,
  { depth = 1, ...options }: IFetchCommitOptions = {},
): Promise<void> => {
  if (!isArgumentValid(url)) {
    throw invalidArgument('url');
  }
  if (!isObjectId(objectId)) {
    throw invalidArgument('objectId');
  }
  if (!Number.isSafeInteger(depth) || depth < 1) {
    throw invalidArgument('depth');
  }
  readSuccessfulOutput(
    await runGit(
      [
        '-c',
        `core.hooksPath=${devNull}`,
        '-c',
        'maintenance.auto=false',
        '-c',
        'gc.auto=0',
        'fetch',
        '--no-tags',
        '--no-write-fetch-head',
        '--no-recurse-submodules',
        `--depth=${depth}`,
        '--end-of-options',
        url,
        objectId,
      ],
      { ...options, cwd },
    ),
    'fetch',
  );
};
