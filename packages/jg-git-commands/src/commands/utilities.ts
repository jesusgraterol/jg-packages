import type { IProcessResult } from 'jg-process';

import { assertGitSucceeded } from '../run-git/index.js';
import { invalidOutput, isArgumentValid, isObjectId } from '../shared/index.js';
import type { IGitStatus, IIndexEntry, IStatusEntry } from './types.js';

// the fields before the path in each kind of porcelain v2 status record
const STATUS_FIELD_COUNTS: Record<string, number> = { '1': 8, '2': 9, u: 10 };

// one `ls-files --stage` record's header: the mode, the object ID, and the stage
const INDEX_ENTRY_HEADER_PATTERN = /^([0-7]{6}) [0-9a-f]{40,64} ([0-3])$/;

/**
 * Gives a command's stdout when it exited with 0.
 * @param result The command's result.
 * @param subcommand The git subcommand that ran, such as `rev-parse`.
 * @returns The stdout.
 * @throws
 * - GIT_REPOSITORY_NOT_FOUND: The directory isn't in a Git repository.
 * - GIT_ACCESS_DENIED: Git can't access the repository.
 * - GIT_COMMAND_FAILED: The git command failed.
 */
export const readSuccessfulOutput = <TOutput extends string | Buffer>(
  result: IProcessResult<TOutput>,
  subcommand: string,
): TOutput => {
  assertGitSucceeded(result, subcommand);
  return result.stdout;
};

/**
 * Decodes output as UTF-8, refusing bytes that aren't, such as a path Git wrote as it is.
 * @param output The command's stdout, as bytes.
 * @param subcommand The git subcommand that wrote it.
 * @returns The text.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const decodeText = (output: Buffer, subcommand: string): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(output);
  } catch {
    throw invalidOutput(subcommand);
  }
};

/**
 * Splits `-z` output into its records, decoding each as UTF-8 and refusing bytes that aren't.
 * @param output The command's stdout, as bytes.
 * @param subcommand The git subcommand that wrote it.
 * @returns The records, without the final empty one.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const decodeRecords = (output: Buffer, subcommand: string): string[] => {
  const text = decodeText(output, subcommand);
  if (text === '') {
    return [];
  }
  const records = text.split('\0');
  if (records.pop() !== '') {
    throw invalidOutput(subcommand);
  }
  return records;
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
 * Reads a status letter from porcelain v2, where `.` stands for unchanged, as porcelain v1's
 * space does.
 * @param letter The letter.
 * @returns The letter, or a space for unchanged.
 */
const toStatusLetter = (letter: string): string => (letter === '.' ? ' ' : letter);

/**
 * Parses `git status --porcelain=v2 -z --branch` records: the `# branch.oid` header, then one
 * record per path, `1` changed, `2` renamed or copied, followed by its original path's record, `u`
 * unmerged, and `?` untracked.
 * @param records The records.
 * @returns The commit HEAD points at, or null before the first commit, and the entries.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const parseStatus = (records: readonly string[]): IGitStatus => {
  let commit: string | null | undefined;
  const entries: IStatusEntry[] = [];
  for (let position = 0; position < records.length; position += 1) {
    const record = records[position] as string;
    if (record.startsWith('# ')) {
      const oid = /^# branch\.oid (.+)$/.exec(record)?.[1];
      if (oid !== undefined) {
        commit = oid === '(initial)' ? null : oid;
      }
      continue;
    }
    const kind = record[0] as string;
    if (kind === '?') {
      if (record.length < 3 || record[1] !== ' ') {
        throw invalidOutput('status');
      }
      entries.push({ index: '?', workingTree: '?', path: record.slice(2), originalPath: null });
      continue;
    }
    const fieldCount = STATUS_FIELD_COUNTS[kind];
    const fields = fieldCount === undefined ? [] : record.split(' ');
    const xy = fields[1] ?? '';
    if (fieldCount === undefined || fields.length <= fieldCount || xy.length !== 2) {
      throw invalidOutput('status');
    }
    let originalPath: string | null = null;
    if (kind === '2') {
      position += 1;
      originalPath = records[position] ?? '';
      if (originalPath === '') {
        throw invalidOutput('status');
      }
    }
    entries.push({
      index: toStatusLetter(xy[0] as string),
      workingTree: toStatusLetter(xy[1] as string),
      path: fields.slice(fieldCount).join(' '),
      originalPath,
    });
  }
  if (commit === undefined || (commit !== null && !isObjectId(commit))) {
    throw invalidOutput('status');
  }
  return { commit, entries };
};

/**
 * Parses `git ls-files --stage -z` records, each `<mode> <object ID> <stage>\t<path>`.
 * @param records The records.
 * @returns The entries.
 * @throws
 * - GIT_OUTPUT_INVALID: Git's output isn't in the expected format.
 */
export const parseIndexEntries = (records: readonly string[]): IIndexEntry[] =>
  records.map((record) => {
    const tab = record.indexOf('\t');
    const header = tab === -1 ? null : INDEX_ENTRY_HEADER_PATTERN.exec(record.slice(0, tab));
    if (header === null || tab === record.length - 1) {
      throw invalidOutput('ls-files');
    }
    return {
      mode: header[1] as string,
      stage: Number(header[2]) as IIndexEntry['stage'],
      path: record.slice(tab + 1),
    };
  });
