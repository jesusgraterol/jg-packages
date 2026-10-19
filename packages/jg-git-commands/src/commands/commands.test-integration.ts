// @vitest-environment node
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
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

import {
  fetchCommit,
  getRemoteUrl,
  isWorkingTreeClean,
  readFileAtRevision,
  readRemoteRefs,
  readStatus,
  resolveCommit,
} from './commands.js';

// the marker programs are POSIX shell scripts
const IS_WINDOWS = process.platform === 'win32';

// every command runs with an isolated config, so the developer's never reaches the tests
const ISOLATED = { isolateConfig: true };

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

    test('fails for a revision that names no commit', async () => {
      const tree = await git(remote, ['rev-parse', 'main^{tree}']);

      for (const rev of ['missing', tree, '--all']) {
        const error = await captureRejection(resolveCommit(remote, rev, ISOLATED));

        expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
        expect(error).toMatchObject({ data: { subcommand: 'rev-parse', exitCode: 1 } });
      }
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
        ISOLATED,
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
        readRemoteRefs(local, 'origin', ['refs/heads/main'], ISOLATED),
      ).resolves.toStrictEqual(new Map([['refs/heads/main', second]]));
    });

    test('fails for a remote that does not exist', async () => {
      const error = await captureRejection(
        readRemoteRefs(
          local,
          pathToFileURL(join(directory, 'missing.git')).href,
          ['refs/heads/main'],
          ISOLATED,
        ),
      );

      expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
      expect(error).toMatchObject({ data: { subcommand: 'ls-remote', exitCode: 128 } });
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
      await expect(readStatus(local, ISOLATED)).resolves.toStrictEqual([]);
      await expect(isWorkingTreeClean(local, ISOLATED)).resolves.toBe(true);
    });

    test('reads changes, a rename with its original path, and untracked files', async () => {
      await git(local, ['mv', 'docs/old name.md', 'docs/café notes.md']);
      await writeFile(join(local, 'a.txt'), 'changed\n');
      await mkdir(join(local, 'notes'));
      await writeFile(join(local, 'notes', 'todo.md'), 'todo\n');

      await expect(readStatus(local, ISOLATED)).resolves.toStrictEqual([
        { index: ' ', workingTree: 'M', path: 'a.txt', originalPath: null },
        {
          index: 'R',
          workingTree: ' ',
          path: 'docs/café notes.md',
          originalPath: 'docs/old name.md',
        },
        { index: '?', workingTree: '?', path: 'notes/', originalPath: null },
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

    test('fails outside a repository', async () => {
      const outside = join(directory, 'outside');
      await mkdir(outside);

      await expectToRejectCode(
        readStatus(outside, { ...ISOLATED, env: { GIT_CEILING_DIRECTORIES: directory } }),
        ERRORS.GIT_COMMAND_FAILED,
      );
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

    test('fails for a file that does not exist, or a directory', async () => {
      for (const path of ['missing.md', 'docs']) {
        const error = await captureRejection(readFileAtRevision(remote, 'main', path, ISOLATED));

        expect(getErrorCode(error)).toBe(ERRORS.GIT_COMMAND_FAILED);
        expect(error).toMatchObject({ data: { subcommand: 'cat-file', exitCode: 128 } });
      }
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
      await fetchCommit(local, remoteUrl, second, ISOLATED);

      await expect(readFileAtRevision(local, second, 'README.md', ISOLATED)).resolves.toBe(
        'second\n',
      );
      await expect(git(local, ['rev-parse', '--is-shallow-repository'])).resolves.toBe('true');
      await expect(git(local, ['cat-file', '-t', first])).rejects.toThrow();
      await expect(git(local, ['for-each-ref'])).resolves.toBe('');
      expect(existsSync(join(local, 'FETCH_HEAD'))).toBe(false);
    });

    test('fetches the history depth asks for', async () => {
      await fetchCommit(local, remoteUrl, second, { ...ISOLATED, depth: 2 });

      await expect(readFileAtRevision(local, first, 'README.md', ISOLATED)).resolves.toBe(
        'first\n',
      );
    });

    test('fails for a commit the remote does not have', async () => {
      const error = await captureRejection(fetchCommit(local, remoteUrl, 'f'.repeat(40), ISOLATED));

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
});
