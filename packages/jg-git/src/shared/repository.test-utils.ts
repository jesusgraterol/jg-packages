import { realpathSync } from 'node:fs';
import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runGit } from '../run-git/index.js';

// the identity fixture commits are made with, on the command line, so no config needs one
const IDENTITY_ARGS = ['-c', 'user.name=jg-git', '-c', 'user.email=jg-git@example.com'];

/**
 * Creates a temporary directory, by its real path, since macOS keeps the temporary directory
 * behind a symbolic link.
 * @param prefix What the directory's name starts with.
 * @returns A promise that resolves to the directory.
 */
export const createTemporaryDirectory = async (prefix: string): Promise<string> =>
  realpathSync(await mkdtemp(join(tmpdir(), `jg-git-${prefix}-`)));

/**
 * Runs git with an isolated config to build a fixture, failing on a non-zero exit.
 * @param cwd The directory git runs in.
 * @param args The command's arguments.
 * @param input What git reads from stdin.
 * @returns A promise that resolves to the trimmed stdout.
 */
export const git = async (cwd: string, args: string[], input?: string): Promise<string> => {
  const result = await runGit(args, {
    cwd,
    isolateConfig: true,
    ...(input === undefined ? {} : { input }),
  });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} exited with ${result.exitCode}: ${result.stderr}`);
  }
  return result.stdout.trim();
};

/**
 * Creates a repository whose first branch is main.
 * @param directory The repository's directory, which must exist.
 * @param isBare Whether the repository has no working tree.
 * @returns A promise that resolves once it's created.
 */
export const initRepository = async (directory: string, isBare = false): Promise<void> => {
  await git(directory, ['init', '--quiet', '--initial-branch=main', ...(isBare ? ['--bare'] : [])]);
};

/**
 * Writes a tree from files, with hash-object and mktree, without a working tree.
 * @param cwd The repository's directory.
 * @param files The text of each file, by its path from the root.
 * @returns A promise that resolves to the tree's object ID.
 */
const writeTree = async (cwd: string, files: Record<string, string>): Promise<string> => {
  const entries: string[] = [];
  const directories = new Map<string, Record<string, string>>();
  for (const [path, content] of Object.entries(files)) {
    const [name = '', ...rest] = path.split('/');
    if (rest.length === 0) {
      entries.push(
        `100644 blob ${await git(cwd, ['hash-object', '-w', '--stdin'], content)}\t${name}`,
      );
    } else {
      directories.set(name, { ...directories.get(name), [rest.join('/')]: content });
    }
  }
  for (const [name, children] of directories) {
    entries.push(`040000 tree ${await writeTree(cwd, children)}\t${name}`);
  }
  return git(cwd, ['mktree'], `${entries.join('\n')}\n`);
};

/**
 * Writes a commit from files, with commit-tree, needing no configured identity.
 * @param cwd The repository's directory.
 * @param files The text of each file, by its path from the root.
 * @param parent The parent commit's object ID, if any.
 * @returns A promise that resolves to the commit's object ID.
 */
export const writeCommit = async (
  cwd: string,
  files: Record<string, string>,
  parent?: string,
): Promise<string> =>
  git(cwd, [
    ...IDENTITY_ARGS,
    'commit-tree',
    await writeTree(cwd, files),
    '-m',
    'fixture',
    ...(parent === undefined ? [] : ['-p', parent]),
  ]);

/**
 * Commits the working tree's changes, with an identity on the command line.
 * @param cwd The repository's directory.
 * @returns A promise that resolves once committed.
 */
export const commitAll = async (cwd: string): Promise<void> => {
  await git(cwd, ['add', '--all']);
  await git(cwd, [...IDENTITY_ARGS, 'commit', '--quiet', '--no-verify', '-m', 'fixture']);
};

// a program that records each run in its marker file
export type IMarkerProgram = {
  path: string;
  markerPath: string;
};

/**
 * Writes a POSIX shell program that appends its arguments to a marker file, then prints its
 * output, standing in for an askpass program or a credential helper.
 * @param directory The directory it's written in.
 * @param name Its file name.
 * @param output What it prints.
 * @returns A promise that resolves to its path and its marker file's path.
 */
export const writeMarkerProgram = async (
  directory: string,
  name: string,
  output: string,
): Promise<IMarkerProgram> => {
  const path = join(directory, name);
  const markerPath = join(directory, `${name}.marker`);
  await writeFile(path, `#!/bin/sh\necho "run $*" >> '${markerPath}'\nprintf '%s' '${output}'\n`);
  await chmod(path, 0o755);
  return { path, markerPath };
};

/**
 * Builds the variables that point Git's user config at a temporary home and skip the system
 * config, so a test that doesn't isolate the config still never reads the developer's.
 * @param home The temporary home directory.
 * @returns The variables.
 */
export const createHomeEnv = (home: string): NodeJS.ProcessEnv => ({
  HOME: home,
  XDG_CONFIG_HOME: join(home, '.config'),
  GIT_CONFIG_NOSYSTEM: '1',
  // a request to the local server never goes through a proxy
  no_proxy: '*',
  NO_PROXY: '*',
});
