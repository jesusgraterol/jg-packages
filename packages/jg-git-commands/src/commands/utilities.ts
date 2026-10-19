import { Exception } from 'jg-exception';
import type { IProcessResult } from 'jg-process';

import { ERRORS, invalidOutput, isArgumentValid, isObjectId } from '../shared/index.js';
import type { IStatusEntry } from './types.js';

/**
 * Gives a command's stdout when it exited with 0.
 * @param result The command's result.
 * @param subcommand The git subcommand that ran, such as `rev-parse`.
 * @returns The stdout.
 * @throws
 * - GIT_COMMAND_FAILED: The git command failed.
 */
export const readSuccessfulOutput = (result: IProcessResult, subcommand: string): string => {
  if (result.exitCode !== 0) {
    // stderr stays out, because it can show a URL with credentials in it
    throw new Exception('The git command failed.', {
      code: ERRORS.GIT_COMMAND_FAILED,
      data: { subcommand, exitCode: result.exitCode },
    });
  }
  return result.stdout;
};

/**
 * Checks whether a value is a full ref name, such as `refs/heads/main`.
 * @param value The value.
 * @returns Whether it is.
 */
export const isRefName = (value: unknown): value is string =>
  isArgumentValid(value) && value.startsWith('refs/') && !/\s/.test(value);

/**
 * Checks whether a value is a revision that `<rev>:<path>` can take: a valid argument without a
 * `:`, which would end it early.
 * @param value The value.
 * @returns Whether it is.
 */
export const isRevisionValid = (value: unknown): value is string =>
  isArgumentValid(value) && !value.includes(':');

/**
 * Checks whether a value is a path inside a repository: relative, with `/` between its segments,
 * and without empty, `.`, or `..` segments, or a backslash.
 * @param value The value.
 * @returns Whether it is.
 */
export const isRepositoryPathValid = (value: unknown): value is string =>
  isArgumentValid(value) &&
  !value.includes('\\') &&
  value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..');

/**
 * Parses `git ls-remote --refs` output into the object ID of each ref asked for. A ref the remote
 * doesn't have is missing from the map, and refs not asked for, which Git's tail matching can
 * list, are left out.
 * @param output The command's stdout.
 * @param refs The full ref names asked for.
 * @returns The object ID of each ref found.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const parseRemoteRefs = (output: string, refs: readonly string[]): Map<string, string> => {
  const wanted = new Set(refs);
  const objectIds = new Map<string, string>();
  for (const line of output.split('\n')) {
    if (line === '') {
      continue;
    }
    const [objectId, ref, ...rest] = line.split('\t');
    if (!isObjectId(objectId) || !isRefName(ref) || rest.length > 0) {
      throw invalidOutput('ls-remote');
    }
    if (wanted.has(ref)) {
      objectIds.set(ref, objectId);
    }
  }
  return objectIds;
};

/**
 * Parses `git status --porcelain=v1 -z` output: one `XY <path>` record per path, followed by the
 * original path's record for a rename or a copy.
 * @param output The command's stdout.
 * @returns The entries, in Git's order.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const parseStatus = (output: string): IStatusEntry[] => {
  const records = output.split('\0');
  if (records.pop() !== '') {
    throw invalidOutput('status');
  }
  const entries: IStatusEntry[] = [];
  for (let position = 0; position < records.length; position += 1) {
    const record = records[position] as string;
    if (record.length < 4 || record[2] !== ' ') {
      throw invalidOutput('status');
    }
    const index = record[0] as string;
    const workingTree = record[1] as string;
    let originalPath: string | null = null;
    if (/[RC]/.test(index + workingTree)) {
      position += 1;
      originalPath = records[position] ?? '';
      if (originalPath === '') {
        throw invalidOutput('status');
      }
    }
    entries.push({ index, workingTree, path: record.slice(3), originalPath });
  }
  return entries;
};
