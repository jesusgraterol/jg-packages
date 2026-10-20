import { assertGitSucceeded, DEFAULT_GIT_MAX_OUTPUT_BYTES, runGit } from '../run-git/index.js';
import {
  GIT_NULL_DEVICE,
  invalidArgument,
  invalidOutput,
  isArgumentValid,
  isObjectId,
} from '../shared/index.js';
import type {
  IFetchCommitOptions,
  IGitCommandOptions,
  IGitStatus,
  IGitVersion,
  IIndexEntry,
  IListPathsOptions,
  IReadChangedPathsOptions,
  IReadFileAtRevisionOptions,
} from './types.js';
import {
  decodeRecords,
  decodeText,
  isRefName,
  isRepositoryPathValid,
  isRevisionValid,
  parseIndexEntries,
  parseRemoteRefs,
  parseStatus,
  readCompleteOutput,
  readSuccessfulOutput,
} from './utilities.js';

/*
 * The line `git version` writes: three numbers, then any suffixes a build adds, such as Git for
 * Windows' `.windows.1`, Microsoft's `.vfs.0.0`, a release candidate's `.rc1`, or a source build's
 * `.123.gabcdef0`, and a vendor's note in parentheses, such as `(Apple Git-154)`.
 */
const GIT_VERSION_PATTERN =
  /^git version (0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:[.-][0-9A-Za-z]+)*(?: \([0-9A-Za-z](?:[0-9A-Za-z ._+/-]*[0-9A-Za-z])?\))?\r?\n$/;

// the transports a command that reaches a remote allows unless the caller's env says otherwise
const REMOTE_PROTOCOLS = 'https:ssh';

/**
 * Checks that every path a caller passes can be a literal pathspec.
 * @param paths The paths, or undefined for all.
 * @returns The arguments that limit a command to them: `--` and the paths.
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 */
const toPathspecArgs = (paths: readonly string[] | undefined): string[] => {
  if (paths === undefined) {
    return ['--'];
  }
  if (!Array.isArray(paths) || !paths.every(isArgumentValid)) {
    throw invalidArgument('paths');
  }
  return ['--', ...paths];
};

/**
 * Resolves a revision, such as a branch, a tag, or an abbreviated object ID, to the full object ID
 * of the commit it names. It reads objects without running anything from the repository's config.
 * @param cwd The repository's directory.
 * @param rev The revision.
 * @param options runGit's options, such as the timeout.
 * @returns A promise that resolves to the commit's object ID, or null when the revision doesn't
 * name a commit, such as a branch that doesn't exist.
 * @example
 * import { resolveCommit } from 'jg-git-commands';
 *
 * const commit = await resolveCommit('/srv/app', 'HEAD'); // null before the first commit
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
): Promise<string | null> => {
  if (!isArgumentValid(rev)) {
    throw invalidArgument('rev');
  }
  const result = await runGit(
    ['rev-parse', '--verify', '--quiet', '--end-of-options', `${rev}^{commit}`],
    { ...options, cwd },
  );
  // --verify --quiet exits with 1, and writes nothing, for a revision that doesn't resolve
  if (result.exitCode === 1 && result.stdout === '') {
    return null;
  }
  const objectId = readSuccessfulOutput(result, 'rev-parse').trim();
  if (!isObjectId(objectId)) {
    throw invalidOutput('rev-parse');
  }
  return objectId;
};

/**
 * Reads the object ID of each ref asked for from a remote, a configured remote's name or a URL,
 * with `git ls-remote --refs`. A ref the remote doesn't have is missing from the map. It allows the
 * HTTPS and SSH transports; set `GIT_ALLOW_PROTOCOL` in `env` for another, such as `file`, over
 * which Git runs the `remote.<name>.uploadpack` command a remote's config names.
 * @param cwd The repository's directory.
 * @param remote The remote's name, such as `origin`, or its URL.
 * @param refs The full ref names, such as `refs/heads/main`.
 * @param options runGit's options, such as `useCredentialHelpers` for an authenticated remote.
 * @returns A promise that resolves to the object ID of each ref found.
 * @example
 * import { readRemoteRefs } from 'jg-git-commands';
 *
 * const refs = await readRemoteRefs('/srv/app', 'origin', ['refs/heads/main', 'refs/tags/v1.0.0']);
 * const main = refs.get('refs/heads/main'); // the commit's object ID, or undefined
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
      env: { GIT_ALLOW_PROTOCOL: REMOTE_PROTOCOLS, ...options.env },
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
 * import { getRemoteUrl } from 'jg-git-commands';
 *
 * const url = await getRemoteUrl('/srv/app');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
 * Reads the working tree's status with `git status --porcelain=v2 -z --branch`: the commit HEAD
 * points at, null before the first commit, and the changed paths, staged or not, renames and
 * copies with their original paths, conflicts with their status letters, and every untracked file
 * that isn't ignored. Submodules are left out. Git runs the clean filters that `.gitattributes`
 * and the config name while it compares files. A path that isn't valid UTF-8 fails the read.
 * @param cwd The repository's directory.
 * @param options runGit's options, such as the output limit.
 * @returns A promise that resolves to the commit and the entries, none for a clean working tree.
 * @example
 * import { readStatus } from 'jg-git-commands';
 *
 * const { commit, entries } = await readStatus('/srv/app');
 * const renamed = entries.filter(({ index }) => index === 'R');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
): Promise<IGitStatus> =>
  parseStatus(
    decodeRecords(
      readSuccessfulOutput(
        await runGit(
          [
            'status',
            '--porcelain=v2',
            '-z',
            '--branch',
            '--untracked-files=all',
            '--ignore-submodules=all',
          ],
          { ...options, cwd, encoding: 'buffer' },
        ),
        'status',
      ),
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
 * import { isWorkingTreeClean } from 'jg-git-commands';
 *
 * if (!(await isWorkingTreeClean('/srv/app'))) {
 *   // commit or stash the changes first
 * }
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
): Promise<boolean> => (await readStatus(cwd, options)).entries.length === 0;

/**
 * Reads a file as UTF-8 text at a revision, with `git cat-file blob <rev>:<path>`, without
 * checking it out and without running anything from the repository's config.
 * @param cwd The repository's directory.
 * @param rev The revision, such as a commit's object ID.
 * @param path The file's path from the repository's root, such as `package.json`.
 * @param options The file's size limit, and runGit's options.
 * @returns A promise that resolves to the file's text, or null when the revision has no file at
 * the path.
 * @example
 * import { readFileAtRevision } from 'jg-git-commands';
 *
 * const manifest = await readFileAtRevision('/srv/app', 'HEAD', 'package.json', { maxBytes: 65_536 });
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed, such as for a revision that doesn't exist, or a path
 * that names a directory.
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
): Promise<string | null> => {
  if (!isRevisionValid(rev)) {
    throw invalidArgument('rev');
  }
  if (!isRepositoryPathValid(path)) {
    throw invalidArgument('path');
  }
  const result = await runGit(['cat-file', 'blob', '--end-of-options', `${rev}:${path}`], {
    ...options,
    cwd,
    maxOutputBytes: maxBytes,
  });
  if (result.exitCode === 0) {
    return result.stdout;
  }
  // cat-file fails the same way for a missing path and a missing revision, so ls-tree tells them
  // apart: it fails for the revision, and lists nothing for a path the revision doesn't have
  const listing = readSuccessfulOutput(
    await runGit(['ls-tree', '-z', '--full-tree', '--end-of-options', rev, '--', path], {
      ...options,
      cwd,
    }),
    'ls-tree',
  );
  if (listing === '') {
    return null;
  }
  assertGitSucceeded(result, 'cat-file');
  return result.stdout;
};

/**
 * Fetches a commit by its object ID from a URL into a repository, with only the history `depth`
 * asks for, and without tags, submodules, hooks, automatic maintenance, or writing `FETCH_HEAD`.
 * Read it afterwards by its object ID, such as with readFileAtRevision. The remote must allow
 * fetching a commit by its object ID, as GitHub does. It allows the HTTPS and SSH transports; set
 * `GIT_ALLOW_PROTOCOL` in `env` for another.
 * @param cwd The repository's directory, such as a bare one made for the fetch.
 * @param url The remote's URL.
 * @param objectId The commit's full object ID.
 * @param options The history's depth, and runGit's options.
 * @returns A promise that resolves once the commit is fetched.
 * @example
 * import { fetchCommit } from 'jg-git-commands';
 *
 * await fetchCommit('/srv/cache/app.git', 'https://github.com/jesusgraterol/jg-packages.git', 'a'.repeat(40));
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
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
        `core.hooksPath=${GIT_NULL_DEVICE}`,
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
      { ...options, cwd, env: { GIT_ALLOW_PROTOCOL: REMOTE_PROTOCOLS, ...options.env } },
    ),
    'fetch',
  );
};

/**
 * Lists the paths that changed between a revision and another, or the working tree, with `git diff
 * --name-only -z`, without external diff programs, text conversion, rename detection, or
 * submodules, so a rename lists both its paths. A path that isn't valid UTF-8 fails the read.
 * @param cwd The repository's directory.
 * @param from The revision the changes start at, such as a base commit.
 * @param options The revision the changes end at, the working tree by default, and runGit's
 * options.
 * @returns A promise that resolves to the paths from the repository's root, in Git's order.
 * @example
 * import { readChangedPaths } from 'jg-git-commands';
 *
 * const changed = await readChangedPaths('/srv/app', 'origin/main', { to: 'HEAD' });
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readChangedPaths = async (
  cwd: string,
  from: string,
  { to, ...options }: IReadChangedPathsOptions = {},
): Promise<string[]> => {
  if (!isArgumentValid(from)) {
    throw invalidArgument('from');
  }
  if (to !== undefined && !isArgumentValid(to)) {
    throw invalidArgument('to');
  }
  const output = readSuccessfulOutput(
    await runGit(
      [
        'diff',
        '--no-ext-diff',
        '--no-textconv',
        '--no-renames',
        '--ignore-submodules=all',
        '--name-only',
        '-z',
        '--end-of-options',
        from,
        ...(to === undefined ? [] : [to]),
        '--',
      ],
      { ...options, cwd, encoding: 'buffer' },
    ),
    'diff',
  );
  return decodeRecords(output, 'diff');
};

/**
 * Lists the index's entries, with `git ls-files --cached --stage -z`: each tracked path's file
 * mode and merge stage, 0 unless it's in a conflict, which lists a path once per stage. A path
 * that isn't valid UTF-8, or a warning from Git, fails the read.
 * @param cwd The repository's directory.
 * @param options The paths to limit the list to, read literally, and runGit's options.
 * @returns A promise that resolves to the entries, paths from the repository's root.
 * @example
 * import { readIndexEntries } from 'jg-git-commands';
 *
 * const links = (await readIndexEntries('/srv/app')).filter(({ mode }) => mode === '120000');
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readIndexEntries = async (
  cwd: string,
  { paths, ...options }: IListPathsOptions = {},
): Promise<IIndexEntry[]> => {
  const pathspec = toPathspecArgs(paths);
  const output = readCompleteOutput(
    await runGit(['ls-files', '--cached', '--stage', '--full-name', '-z', ...pathspec], {
      ...options,
      cwd,
      encoding: 'buffer',
    }),
    'ls-files',
  );
  return parseIndexEntries(decodeRecords(output, 'ls-files'));
};

/**
 * Lists the untracked files that aren't ignored, with `git ls-files --others --exclude-standard
 * -z`, each file in an untracked directory included. A path that isn't valid UTF-8 fails the read,
 * and so does a warning from Git, such as for a directory it couldn't open, which it otherwise
 * leaves out of the list while still succeeding.
 * @param cwd The repository's directory.
 * @param options The paths to limit the list to, read literally, and runGit's options.
 * @returns A promise that resolves to the paths from the repository's root.
 * @example
 * import { listUntrackedFiles } from 'jg-git-commands';
 *
 * const untracked = await listUntrackedFiles('/srv/app', { paths: ['docs'] });
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const listUntrackedFiles = async (
  cwd: string,
  { paths, ...options }: IListPathsOptions = {},
): Promise<string[]> => {
  const pathspec = toPathspecArgs(paths);
  const output = readCompleteOutput(
    await runGit(['ls-files', '--others', '--exclude-standard', '--full-name', '-z', ...pathspec], {
      ...options,
      cwd,
      encoding: 'buffer',
    }),
    'ls-files',
  );
  return decodeRecords(output, 'ls-files');
};

/**
 * Reads the root of the working tree a directory is in, with `git rev-parse --show-toplevel`.
 * It's null inside a `.git` directory or a bare repository, which have no working tree, and fails
 * with GIT_REPOSITORY_NOT_FOUND outside any repository.
 * @param cwd The directory.
 * @param options runGit's options, such as the timeout.
 * @returns A promise that resolves to the working tree's root, or null.
 * @example
 * import { readTopLevel } from 'jg-git-commands';
 *
 * const root = await readTopLevel('/srv/app/src'); // '/srv/app'
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readTopLevel = async (
  cwd: string,
  options: IGitCommandOptions = {},
): Promise<string | null> => {
  const inside = readSuccessfulOutput(
    await runGit(['rev-parse', '--is-inside-work-tree'], { ...options, cwd }),
    'rev-parse',
  ).trim();
  if (inside === 'false') {
    return null;
  }
  if (inside !== 'true') {
    throw invalidOutput('rev-parse');
  }
  const output = decodeText(
    readSuccessfulOutput(
      await runGit(['rev-parse', '--show-toplevel'], { ...options, cwd, encoding: 'buffer' }),
      'rev-parse',
    ),
    'rev-parse',
  );
  // the path, which may hold spaces, ends with one line feed
  const root = output.endsWith('\n') ? output.slice(0, -1) : '';
  if (root === '' || root.includes('\n')) {
    throw invalidOutput('rev-parse');
  }
  return root;
};

/**
 * Reads a boolean config value, such as `core.symlinks`, with `git config --type=bool`, so every
 * form Git accepts, such as `yes` or `on`, reads as true. A key that isn't set reads as the default.
 * @param cwd The repository's directory.
 * @param key The key, such as `core.sparseCheckout`.
 * @param defaultValue The value when the key isn't set.
 * @param options runGit's options, such as `isolateConfig`.
 * @returns A promise that resolves to the value.
 * @example
 * import { readConfigBoolean } from 'jg-git-commands';
 *
 * const hasSymlinks = await readConfigBoolean('/srv/app', 'core.symlinks', true);
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed, such as for a value that isn't a boolean.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readConfigBoolean = async (
  cwd: string,
  key: string,
  defaultValue: boolean,
  options: IGitCommandOptions = {},
): Promise<boolean> => {
  if (!isArgumentValid(key) || key.startsWith('-') || /\s/.test(key)) {
    throw invalidArgument('key');
  }
  if (typeof defaultValue !== 'boolean') {
    throw invalidArgument('defaultValue');
  }
  const value = readSuccessfulOutput(
    await runGit(['config', '--type=bool', `--default=${String(defaultValue)}`, '--get', key], {
      ...options,
      cwd,
    }),
    'config',
  );
  if (value !== 'true\n' && value !== 'false\n') {
    throw invalidOutput('config');
  }
  return value === 'true\n';
};

/**
 * Reads the installed Git's version, with `git version`, whatever suffixes the build adds, such as
 * Git for Windows' `2.45.1.windows.1`, Microsoft's `2.45.2.vfs.0.0`, a release candidate's
 * `2.48.0.rc1`, or Apple's `2.39.5 (Apple Git-154)`.
 * @param cwd The directory git runs in.
 * @param options runGit's options, such as the timeout.
 * @returns A promise that resolves to the version.
 * @example
 * import { readGitVersion } from 'jg-git-commands';
 *
 * const { major, minor } = await readGitVersion('/srv/app');
 * if (major < 2 || (major === 2 && minor < 32)) {
 *   // ask for Git 2.32 or later
 * }
 * @throws
 * - GIT_INVALID_ARGUMENT: An argument isn't valid.
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 * - GIT_NOT_FOUND: Git isn't installed, or isn't on the PATH.
 * - PROCESS_START_FAILED: Unable to start the command
 * - PROCESS_TIMED_OUT: The process didn't finish within the timeout
 * - PROCESS_OUTPUT_TOO_LARGE: The process wrote more output than allowed
 * - PROCESS_TREE_SURVIVED: The process tree is still running after it was force-stopped
 * - The signal's reason when the signal aborts.
 */
export const readGitVersion = async (
  cwd: string,
  options: IGitCommandOptions = {},
): Promise<IGitVersion> => {
  const output = readSuccessfulOutput(await runGit(['version'], { ...options, cwd }), 'version');
  const match = GIT_VERSION_PATTERN.exec(output);
  const version = {
    major: Number(match?.[1]),
    minor: Number(match?.[2]),
    patch: Number(match?.[3]),
  };
  if (!Object.values(version).every(Number.isSafeInteger)) {
    throw invalidOutput('version');
  }
  return version;
};
