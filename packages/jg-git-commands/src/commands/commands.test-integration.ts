// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getErrorCode } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { ERRORS as PROCESS_ERRORS } from 'jg-process';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import {
  commitAll,
  createTemporaryDirectory,
  git,
  initRepository,
  writeCommit,
  writeMarkerProgram,
} from '../shared/repository.test-utils.js';

import { runGit } from '../run-git/index.js';

import {
  fetchCommit,
  getRemoteUrl,
  isWorkingTreeClean,
  listUntrackedFiles,
  readChangedPaths,
  readConfigBoolean,
  readFileAtRevision,
  readGitVersion,
  readIndexEntries,
  readRemoteRefs,
  readStatus,
  readTopLevel,
  resolveCommit,
} from './commands.js';

// the marker programs are POSIX shell scripts
const IS_WINDOWS = process.platform === 'win32';

// every command runs with an isolated config, so the developer's never reaches the tests
const ISOLATED = { isolateConfig: true };

// the remote tests read local repositories, over the file transport, which runGit refuses unless
// allowed
const FILE_TRANSPORT = { ...ISOLATED, env: { GIT_ALLOW_PROTOCOL: 'file' } };

/**
 * Captures what a promise rejects with.
 * @param promise The promise.
 * @returns A promise that resolves to the rejection, or undefined when it resolves.
 */
const captureRejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
};

describe('git commands', () => {
  let directory: string;
  let remote: string;
  let remoteUrl: string;
  let first: string;
  let second: string;

  beforeEach(async () => {
    directory = await createTemporaryDirectory('commands');
    remote = join(directory, 'remote.git');
    await mkdir(remote);
    await initRepository(remote, true);
    first = await writeCommit(remote, { 'README.md': 'first\n' });
    second = await writeCommit(
      remote,
      { 'README.md': 'second\n', 'docs/guide.md': '# Guide\n', 'docs/café notes.md': 'notes\n' },
      first,
    );
    await git(remote, ['update-ref', 'refs/heads/main', second]);
    await git(remote, [
      '-c',
      'user.name=jg-git-commands',
      '-c',
      'user.email=jg-git-commands@example.com',
      'tag',
      '--annotate',
      '-m',
      'v1',
      'v1.0.0',
      second,
    ]);
    remoteUrl = pathToFileURL(remote).href;
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('resolveCommit', () => {
    test('resolves a branch, an abbreviated object ID, and an annotated tag to the commit', async () => {
      await expect(resolveCommit(remote, 'main', ISOLATED)).resolves.toBe(second);
      await expect(resolveCommit(remote, second.slice(0, 12), ISOLATED)).resolves.toBe(second);
      await expect(resolveCommit(remote, 'v1.0.0', ISOLATED)).resolves.toBe(second);
      await expect(resolveCommit(remote, 'main~1', ISOLATED)).resolves.toBe(first);
    });

    test('resolves to null for a revision that names no commit', async () => {
      const tree = await git(remote, ['rev-parse', 'main^{tree}']);

      for (const rev of ['missing', tree, '--all']) {
        await expect(resolveCommit(remote, rev, ISOLATED)).resolves.toBeNull();
      }
    });

    test('resolves HEAD to null before the first commit', async () => {
      const empty = join(directory, 'empty');
      await mkdir(empty);
      await initRepository(empty);

      await expect(resolveCommit(empty, 'HEAD', ISOLATED)).resolves.toBeNull();
    });

    test('fails with GIT_REPOSITORY_NOT_FOUND outside a repository', async () => {
      const outside = join(directory, 'outside');
      await mkdir(outside);

      await expectToRejectCode(
        resolveCommit(outside, 'HEAD', {
          ...ISOLATED,
          env: { GIT_CEILING_DIRECTORIES: directory },
        }),
        ERRORS.GIT_REPOSITORY_NOT_FOUND,
      );
    });

    test('rejects an empty revision', async () => {
      await expectToRejectCode(resolveCommit(remote, '', ISOLATED), ERRORS.GIT_INVALID_ARGUMENT);
    });
  });

  describe('readRemoteRefs', () => {
    let local: string;

    beforeEach(async () => {
      local = join(directory, 'local');
      await mkdir(local);
      await initRepository(local);
    });

    test('reads the refs asked for from a URL over the file transport', async () => {
      const refs = await readRemoteRefs(
        local,
        remoteUrl,
        ['refs/heads/main', 'refs/tags/v1.0.0', 'refs/heads/missing'],
        FILE_TRANSPORT,
      );
      const tag = await git(remote, ['rev-parse', 'refs/tags/v1.0.0']);

      expect(refs).toStrictEqual(
        new Map([
          ['refs/heads/main', second],
          ['refs/tags/v1.0.0', tag],
        ]),
      );
    });

    test("reads them through a configured remote's name", async () => {
      await git(local, ['remote', 'add', 'origin', remoteUrl]);

      await expect(
        readRemoteRefs(local, 'origin', ['refs/heads/main'], FILE_TRANSPORT),
      ).resolves.toStrictEqual(new Map([['refs/heads/main', second]]));
    });

    test('fails for a remote that does not exist', async () => {
      const error = await captureRejection(
        readRemoteRefs(
          local,
          pathToFileURL(join(directory, 'missing.git')).href,
          ['refs/heads/main'],
          FILE_TRANSPORT,
        ),
      );

      expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(error).toMatchObject({ data: { subcommand: 'ls-remote', exitCode: 128 } });
    });

    test('refuses the file transport unless env allows it, allowing HTTPS and SSH by default', async () => {
      await expectToRejectCode(
        readRemoteRefs(local, remoteUrl, ['refs/heads/main'], ISOLATED),
        ERRORS.GIT_COMMAND_FAILED,
      );
    });

    test.each([
      ['an empty remote', '', ['refs/heads/main']],
      ['no refs', 'origin', []],
      ['a short ref name', 'origin', ['main']],
      ['refs that are not an array', 'origin', 'refs/heads/main'],
    ])('rejects %s', async (_description, remoteName, refs) => {
      await expectToRejectCode(
        readRemoteRefs(local, remoteName, refs as string[], ISOLATED),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });
  });

  describe('getRemoteUrl', () => {
    let local: string;

    beforeEach(async () => {
      local = join(directory, 'local');
      await mkdir(local);
      await initRepository(local);
      await git(local, ['remote', 'add', 'origin', remoteUrl]);
      await git(local, ['remote', 'add', 'upstream', 'https://example.com/upstream.git']);
    });

    test("reads origin's URL by default, and another remote's by its name", async () => {
      await expect(getRemoteUrl(local, undefined, ISOLATED)).resolves.toBe(remoteUrl);
      await expect(getRemoteUrl(local, 'upstream', ISOLATED)).resolves.toBe(
        'https://example.com/upstream.git',
      );
    });

    test('applies an insteadOf rewrite from the config', async () => {
      await git(local, [
        'config',
        'url.https://mirror.example.com/.insteadOf',
        'https://example.com/',
      ]);

      await expect(getRemoteUrl(local, 'upstream', ISOLATED)).resolves.toBe(
        'https://mirror.example.com/upstream.git',
      );
    });

    test('fails for a remote that does not exist', async () => {
      const error = await captureRejection(getRemoteUrl(local, 'missing', ISOLATED));

      expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(error).toMatchObject({ data: { subcommand: 'remote', exitCode: 2 } });
    });

    test('rejects an empty name', async () => {
      await expectToRejectCode(getRemoteUrl(local, '', ISOLATED), ERRORS.GIT_INVALID_ARGUMENT);
    });
  });

  describe('readStatus and isWorkingTreeClean', () => {
    let local: string;

    beforeEach(async () => {
      local = join(directory, 'local');
      await mkdir(join(local, 'docs'), { recursive: true });
      await initRepository(local);
      await writeFile(join(local, 'a.txt'), 'a\n');
      await writeFile(join(local, 'docs', 'old name.md'), 'notes\n');
      await commitAll(local);
    });

    test('reads a clean working tree as clean', async () => {
      const head = await git(local, ['rev-parse', 'HEAD']);

      await expect(readStatus(local, ISOLATED)).resolves.toStrictEqual({
        commit: head,
        entries: [],
      });
      await expect(isWorkingTreeClean(local, ISOLATED)).resolves.toBe(true);
    });

    test('reads changes, a rename with its original path, and untracked files', async () => {
      await git(local, ['mv', 'docs/old name.md', 'docs/café notes.md']);
      await writeFile(join(local, 'a.txt'), 'changed\n');
      await mkdir(join(local, 'notes'));
      await writeFile(join(local, 'notes', 'todo.md'), 'todo\n');

      const { entries } = await readStatus(local, ISOLATED);

      expect(entries).toStrictEqual([
        { index: ' ', workingTree: 'M', path: 'a.txt', originalPath: null },
        {
          index: 'R',
          workingTree: ' ',
          path: 'docs/café notes.md',
          originalPath: 'docs/old name.md',
        },
        { index: '?', workingTree: '?', path: 'notes/todo.md', originalPath: null },
      ]);
      await expect(isWorkingTreeClean(local, ISOLATED)).resolves.toBe(false);
    });

    test('reports untracked files even when the config hides them', async () => {
      await git(local, ['config', 'status.showUntrackedFiles', 'no']);
      await writeFile(join(local, 'untracked.txt'), 'new\n');

      await expect(isWorkingTreeClean(local, ISOLATED)).resolves.toBe(false);
    });

    test.skipIf(IS_WINDOWS)("never runs the repository config's file system monitor", async () => {
      const monitor = await writeMarkerProgram(directory, 'fsmonitor', '');
      await git(local, ['config', 'core.fsmonitor', monitor.path]);

      await expect(isWorkingTreeClean(local, ISOLATED)).resolves.toBe(true);
      expect(existsSync(monitor.markerPath)).toBe(false);
    });

    test('fails with GIT_REPOSITORY_NOT_FOUND outside a repository', async () => {
      const outside = join(directory, 'outside');
      await mkdir(outside);

      await expectToRejectCode(
        readStatus(outside, { ...ISOLATED, env: { GIT_CEILING_DIRECTORIES: directory } }),
        ERRORS.GIT_REPOSITORY_NOT_FOUND,
      );
    });

    test('reads a null commit and the untracked files before the first commit', async () => {
      const empty = join(directory, 'empty');
      await mkdir(empty);
      await initRepository(empty);
      await writeFile(join(empty, 'new.txt'), 'new\n');

      await expect(readStatus(empty, ISOLATED)).resolves.toStrictEqual({
        commit: null,
        entries: [{ index: '?', workingTree: '?', path: 'new.txt', originalPath: null }],
      });
    });

    test('reads a conflict with its status letters', async () => {
      await git(local, ['checkout', '--quiet', '-b', 'other']);
      await writeFile(join(local, 'a.txt'), 'other\n');
      await commitAll(local);
      await git(local, ['checkout', '--quiet', 'main']);
      await writeFile(join(local, 'a.txt'), 'main\n');
      await commitAll(local);
      // the merge stops at the conflict, exiting with 1
      await git(local, [
        '-c',
        'user.name=jg-git-commands',
        '-c',
        'user.email=jg-git-commands@example.com',
        'merge',
        '--quiet',
        'other',
      ]).catch(() => undefined);

      const { entries } = await readStatus(local, ISOLATED);

      expect(entries).toStrictEqual([
        { index: 'U', workingTree: 'U', path: 'a.txt', originalPath: null },
      ]);
    });
  });

  describe('readFileAtRevision', () => {
    test('reads a file, a nested one, and one with spaces and accents, at a revision', async () => {
      await expect(readFileAtRevision(remote, first, 'README.md', ISOLATED)).resolves.toBe(
        'first\n',
      );
      await expect(readFileAtRevision(remote, 'main', 'docs/guide.md', ISOLATED)).resolves.toBe(
        '# Guide\n',
      );
      await expect(
        readFileAtRevision(remote, 'v1.0.0', 'docs/café notes.md', ISOLATED),
      ).resolves.toBe('notes\n');
    });

    test('resolves to null for a path the revision has no file at', async () => {
      await expect(readFileAtRevision(remote, 'main', 'missing.md', ISOLATED)).resolves.toBeNull();
      await expect(
        readFileAtRevision(remote, first, 'docs/guide.md', ISOLATED),
      ).resolves.toBeNull();
    });

    test('fails for a directory, and for a revision that does not exist', async () => {
      const directoryError = await captureRejection(
        readFileAtRevision(remote, 'main', 'docs', ISOLATED),
      );
      const revisionError = await captureRejection(
        readFileAtRevision(remote, 'missing', 'README.md', ISOLATED),
      );

      expect(getErrorCode(directoryError)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(directoryError).toMatchObject({ data: { subcommand: 'cat-file', exitCode: 128 } });
      expect(getErrorCode(revisionError)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(revisionError).toMatchObject({ data: { subcommand: 'ls-tree', exitCode: 128 } });
    });

    test('rejects a file larger than maxBytes', async () => {
      await expectToRejectCode(
        readFileAtRevision(remote, 'main', 'docs/guide.md', { ...ISOLATED, maxBytes: 4 }),
        PROCESS_ERRORS.PROCESS_OUTPUT_TOO_LARGE,
      );
    });

    test.each([
      ['a revision with a colon', 'main:README.md', 'README.md'],
      ['an absolute path', 'main', '/README.md'],
      ['a path that climbs out', 'main', '../README.md'],
      ['a path with a null character', 'main', 'README.md\0'],
    ])('rejects %s', async (_description, rev, path) => {
      await expectToRejectCode(
        readFileAtRevision(remote, rev, path, ISOLATED),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });
  });

  describe.skipIf(IS_WINDOWS)('output that is not in the expected format', () => {
    let bin: string;

    beforeEach(async () => {
      // a git that prints JG_GIT_FAKE_OUTPUT and exits with 0
      bin = join(directory, 'bin');
      await mkdir(bin);
      await writeFile(join(bin, 'git'), '#!/bin/sh\nprintf "%s" "$JG_GIT_FAKE_OUTPUT"\n', {
        mode: 0o755,
      });
    });

    /**
     * Builds the options that run the fake git with an output.
     * @param output What it prints.
     * @returns The options.
     */
    const fakeOutput = (output: string): { env: NodeJS.ProcessEnv } => ({
      env: { PATH: bin, JG_GIT_FAKE_OUTPUT: output },
    });

    test.each(['not an object id', 'a'.repeat(39), ''])(
      'resolveCommit(%o) -> GIT_OUTPUT_INVALID',
      async (output) => {
        await expectToRejectCode(
          resolveCommit(remote, 'main', fakeOutput(output)),
          ERRORS.GIT_OUTPUT_INVALID,
        );
      },
    );

    test.each(['', 'https://a.example.com/r.git\nhttps://b.example.com/r.git'])(
      'getRemoteUrl(%o) -> GIT_OUTPUT_INVALID',
      async (output) => {
        await expectToRejectCode(
          getRemoteUrl(remote, 'origin', fakeOutput(output)),
          ERRORS.GIT_OUTPUT_INVALID,
        );
      },
    );

    test.each([
      ['git version 2.45.1\n', { major: 2, minor: 45, patch: 1 }],
      ['git version 2.39.2.windows.1\n', { major: 2, minor: 39, patch: 2 }],
      ['git version 2.39.5 (Apple Git-154)\n', { major: 2, minor: 39, patch: 5 }],
    ])('readGitVersion(%j) -> %o', async (output, version) => {
      await expect(readGitVersion(remote, fakeOutput(output))).resolves.toStrictEqual(version);
    });

    test.each(['git version 2.45\n', 'git version 2.45.1-rc1\n', 'version 2.45.1\n', ''])(
      'readGitVersion(%j) -> GIT_OUTPUT_INVALID',
      async (output) => {
        await expectToRejectCode(
          readGitVersion(remote, fakeOutput(output)),
          ERRORS.GIT_OUTPUT_INVALID,
        );
      },
    );

    test('readConfigBoolean and readTopLevel reject what they cannot parse', async () => {
      await expectToRejectCode(
        readConfigBoolean(remote, 'jg.flag', false, fakeOutput('yes\n')),
        ERRORS.GIT_OUTPUT_INVALID,
      );
      await expectToRejectCode(
        readTopLevel(remote, fakeOutput('maybe\n')),
        ERRORS.GIT_OUTPUT_INVALID,
      );
      // 'true' answers the first question, but isn't a path ending with a line feed
      await expectToRejectCode(readTopLevel(remote, fakeOutput('true')), ERRORS.GIT_OUTPUT_INVALID);
    });

    test('readRemoteRefs and readStatus reject what they cannot parse', async () => {
      await expectToRejectCode(
        readRemoteRefs(remote, 'origin', ['refs/heads/main'], fakeOutput('garbage\n')),
        ERRORS.GIT_OUTPUT_INVALID,
      );
      await expectToRejectCode(
        readStatus(remote, fakeOutput('garbage')),
        ERRORS.GIT_OUTPUT_INVALID,
      );
    });
  });

  describe('fetchCommit', () => {
    let local: string;

    beforeEach(async () => {
      local = join(directory, 'local.git');
      await mkdir(local);
      await initRepository(local, true);
    });

    test('fetches only the pinned commit, without tags, for reading by its object ID', async () => {
      await fetchCommit(local, remoteUrl, second, FILE_TRANSPORT);

      await expect(readFileAtRevision(local, second, 'README.md', ISOLATED)).resolves.toBe(
        'second\n',
      );
      await expect(git(local, ['rev-parse', '--is-shallow-repository'])).resolves.toBe('true');
      await expect(git(local, ['cat-file', '-t', first])).rejects.toThrow();
      await expect(git(local, ['for-each-ref'])).resolves.toBe('');
      expect(existsSync(join(local, 'FETCH_HEAD'))).toBe(false);
    });

    test('fetches the history depth asks for', async () => {
      await fetchCommit(local, remoteUrl, second, { ...FILE_TRANSPORT, depth: 2 });

      await expect(readFileAtRevision(local, first, 'README.md', ISOLATED)).resolves.toBe(
        'first\n',
      );
    });

    test('fails for a commit the remote does not have', async () => {
      const error = await captureRejection(
        fetchCommit(local, remoteUrl, 'f'.repeat(40), FILE_TRANSPORT),
      );

      expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(error).toMatchObject({ data: { subcommand: 'fetch', exitCode: 128 } });
    });

    test.each([
      ['an empty URL', '', 'a'.repeat(40), 1],
      ['an abbreviated object ID', 'file:///remote.git', 'a'.repeat(12), 1],
      ['a depth of 0', 'file:///remote.git', 'a'.repeat(40), 0],
      ['a fractional depth', 'file:///remote.git', 'a'.repeat(40), 1.5],
    ])('rejects %s', async (_description, url, objectId, depth) => {
      await expectToRejectCode(
        fetchCommit(local, url, objectId, { ...ISOLATED, depth }),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });
  });

  describe('typed reads', () => {
    let local: string;
    let base: string;

    beforeEach(async () => {
      local = join(directory, 'local');
      await mkdir(join(local, 'docs'), { recursive: true });
      await initRepository(local);
      await writeFile(join(local, 'a.txt'), 'a\n');
      await writeFile(join(local, 'docs', 'guide.md'), 'guide\n');
      await commitAll(local);
      base = await git(local, ['rev-parse', 'HEAD']);
    });

    test('readChangedPaths lists the paths changed between revisions, or up to the working tree', async () => {
      await git(local, ['mv', 'docs/guide.md', 'docs/renamed guide.md']);
      await writeFile(join(local, 'b.txt'), 'b\n');
      await git(local, ['add', 'b.txt']);
      await commitAll(local);
      const head = await git(local, ['rev-parse', 'HEAD']);
      await writeFile(join(local, 'a.txt'), 'changed\n');

      await expect(readChangedPaths(local, base, { ...ISOLATED, to: head })).resolves.toStrictEqual(
        ['b.txt', 'docs/guide.md', 'docs/renamed guide.md'],
      );
      await expect(readChangedPaths(local, head, ISOLATED)).resolves.toStrictEqual(['a.txt']);
      await expect(readChangedPaths(local, head, { ...ISOLATED, to: head })).resolves.toStrictEqual(
        [],
      );
    });

    test('readChangedPaths fails for a revision that does not exist', async () => {
      await expectToRejectCode(
        readChangedPaths(local, 'missing', ISOLATED),
        ERRORS.GIT_COMMAND_FAILED,
      );
      await expectToRejectCode(readChangedPaths(local, '', ISOLATED), ERRORS.GIT_INVALID_ARGUMENT);
      await expectToRejectCode(
        readChangedPaths(local, base, { ...ISOLATED, to: '' }),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });

    test('readIndexEntries lists each tracked path with its mode and stage, limited to paths', async () => {
      await expect(readIndexEntries(local, ISOLATED)).resolves.toStrictEqual([
        { mode: '100644', stage: 0, path: 'a.txt' },
        { mode: '100644', stage: 0, path: 'docs/guide.md' },
      ]);
      await expect(
        readIndexEntries(local, { ...ISOLATED, paths: ['docs'] }),
      ).resolves.toStrictEqual([{ mode: '100644', stage: 0, path: 'docs/guide.md' }]);
      await expectToRejectCode(
        readIndexEntries(local, { ...ISOLATED, paths: [''] }),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });

    test.skipIf(IS_WINDOWS)('readIndexEntries lists a symbolic link with its mode', async () => {
      await symlink('a.txt', join(local, 'link'));
      await git(local, ['add', 'link']);

      await expect(
        readIndexEntries(local, { ...ISOLATED, paths: ['link'] }),
      ).resolves.toStrictEqual([{ mode: '120000', stage: 0, path: 'link' }]);
    });

    test('listUntrackedFiles lists each untracked file that is not ignored, limited to paths', async () => {
      await mkdir(join(local, 'notes', 'deep'), { recursive: true });
      await writeFile(join(local, 'notes', 'deep', 'todo.md'), 'todo\n');
      await writeFile(join(local, 'notes', 'ignored.log'), 'log\n');
      await writeFile(join(local, '.gitignore'), '*.log\n');
      await writeFile(join(local, 'root file.txt'), 'x\n');

      await expect(listUntrackedFiles(local, ISOLATED)).resolves.toStrictEqual([
        '.gitignore',
        'notes/deep/todo.md',
        'root file.txt',
      ]);
      await expect(
        listUntrackedFiles(local, { ...ISOLATED, paths: ['notes'] }),
      ).resolves.toStrictEqual(['notes/deep/todo.md']);
    });

    test('readTopLevel reads the root of the working tree from any directory in it', async () => {
      await expect(readTopLevel(join(local, 'docs'), ISOLATED)).resolves.toBe(local);
      await expect(readTopLevel(local, ISOLATED)).resolves.toBe(local);
    });

    test('readTopLevel is null inside .git and in a bare repository', async () => {
      await expect(readTopLevel(join(local, '.git'), ISOLATED)).resolves.toBeNull();
      await expect(readTopLevel(remote, ISOLATED)).resolves.toBeNull();
    });

    test('readTopLevel fails with GIT_REPOSITORY_NOT_FOUND outside any repository', async () => {
      const outside = join(directory, 'outside');
      await mkdir(outside);

      await expectToRejectCode(
        readTopLevel(outside, { ...ISOLATED, env: { GIT_CEILING_DIRECTORIES: directory } }),
        ERRORS.GIT_REPOSITORY_NOT_FOUND,
      );
    });

    test('readConfigBoolean reads every form Git accepts, and the default for a missing key', async () => {
      await git(local, ['config', 'core.sparseCheckout', 'yes']);
      await git(local, ['config', 'jg.flag', 'off']);

      await expect(readConfigBoolean(local, 'core.sparseCheckout', false, ISOLATED)).resolves.toBe(
        true,
      );
      await expect(readConfigBoolean(local, 'jg.flag', true, ISOLATED)).resolves.toBe(false);
      await expect(readConfigBoolean(local, 'jg.missing', true, ISOLATED)).resolves.toBe(true);
      await expect(readConfigBoolean(local, 'jg.missing', false, ISOLATED)).resolves.toBe(false);
    });

    test('readConfigBoolean fails for a value that is not a boolean, and a key that is not valid', async () => {
      await git(local, ['config', 'jg.flag', 'maybe']);

      await expectToRejectCode(
        readConfigBoolean(local, 'jg.flag', false, ISOLATED),
        ERRORS.GIT_COMMAND_FAILED,
      );
      for (const key of ['', '--global', 'a key']) {
        await expectToRejectCode(
          readConfigBoolean(local, key, false, ISOLATED),
          ERRORS.GIT_INVALID_ARGUMENT,
        );
      }
      await expectToRejectCode(
        readConfigBoolean(local, 'jg.flag', 'yes' as unknown as boolean, ISOLATED),
        ERRORS.GIT_INVALID_ARGUMENT,
      );
    });

    test('readGitVersion reads the installed version, Git 2.32 or later', async () => {
      const { major, minor, patch } = await readGitVersion(local, ISOLATED);

      expect(major * 1000 + minor).toBeGreaterThanOrEqual(2032);
      expect(Number.isSafeInteger(patch)).toBe(true);
    });

    test.skipIf(process.platform !== 'linux')(
      'fails with GIT_OUTPUT_INVALID for a path that is not valid UTF-8',
      async () => {
        const invalidName = Buffer.concat([Buffer.from(join(local, 'bad-')), Buffer.from([0xff])]);
        await writeFile(invalidName, 'x\n');

        await expectToRejectCode(listUntrackedFiles(local, ISOLATED), ERRORS.GIT_OUTPUT_INVALID);
        await expectToRejectCode(readStatus(local, ISOLATED), ERRORS.GIT_OUTPUT_INVALID);
      },
    );
  });

  describe('partial clones', () => {
    let clone: string;
    let readmeObjectId: string;

    beforeEach(async () => {
      await git(remote, ['config', 'uploadpack.allowFilter', 'true']);
      clone = join(directory, 'clone');
      const result = await runGit(
        ['clone', '--quiet', '--bare', '--filter=blob:none', '--no-local', remoteUrl, clone],
        { cwd: directory, isolateConfig: true, env: { GIT_ALLOW_PROTOCOL: 'file' } },
      );
      expect(result.exitCode).toBe(0);
      readmeObjectId = await git(remote, ['rev-parse', `${second}:README.md`]);
    });

    /**
     * Lists the objects the clone is missing.
     * @returns A promise that resolves to `git rev-list --missing=print`'s output.
     */
    const listMissing = async (): Promise<string> =>
      (
        await runGit(['rev-list', '--objects', '--missing=print', second], {
          cwd: clone,
          isolateConfig: true,
        })
      ).stdout;

    test.each([
      ['by default', [], {}],
      [
        "when the repository's config allows the file transport",
        ['protocol.file.allow', 'always'],
        {},
      ],
      // Git before 2.45 ignores GIT_NO_LAZY_FETCH, so the empty GIT_ALLOW_PROTOCOL must block it
      ['when lazy fetching is on, as on Git before 2.45', [], { GIT_NO_LAZY_FETCH: '0' }],
    ])('never fetches a missing object %s', async (_description, config, env) => {
      if (config.length > 0) {
        await git(clone, ['config', ...config]);
      }

      const error = await captureRejection(
        readFileAtRevision(clone, second, 'README.md', { ...ISOLATED, env }),
      );

      expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(await listMissing()).toContain(`?${readmeObjectId}`);
    });

    test('fetches it when the caller allows the transport and lazy fetching', async () => {
      await expect(
        readFileAtRevision(clone, second, 'README.md', {
          ...ISOLATED,
          env: { GIT_ALLOW_PROTOCOL: 'file', GIT_NO_LAZY_FETCH: '0' },
        }),
      ).resolves.toBe('second\n');
      expect(await listMissing()).not.toContain(`?${readmeObjectId}`);
    });
  });
});
