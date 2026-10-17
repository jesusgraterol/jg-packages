import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { writePublishedEntries, writeReleaseManifest } from '../shared/release-files.ts';
import { runCommand } from '../shared/run-command.ts';
import { tagRelease } from './tag.ts';
import type { IPublishedEntry } from '../shared/types.ts';

let workDirectory: string;
let cloneDirectory: string;
let releaseDirectory: string;
let isolatedEnvironment: NodeJS.ProcessEnv;

/*
 * Git runs with an empty HOME, no system configuration, and `user.useConfigOnly`, so it has no
 * identity and can't guess one from the machine, like a GitHub runner.
 */
const createIsolatedEnvironment = (home: string): NodeJS.ProcessEnv => ({
  PATH: process.env['PATH'],
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'user.useConfigOnly',
  GIT_CONFIG_VALUE_0: 'true',
});

// runs git in the clone with the isolated environment and fails on errors
const git = async (args: string[], cwd = cloneDirectory): Promise<string> => {
  const result = await runCommand('git', args, { cwd, env: isolatedEnvironment });
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
};

// runs the tag command for the given published versions
const tag = async (published: IPublishedEntry[]) => {
  const publishedFile = await writePublishedEntries(releaseDirectory, published);
  const logs: string[] = [];
  const pushed = await tagRelease(releaseDirectory, publishedFile, {
    runGit: (args) => runCommand('git', args, { cwd: cloneDirectory, env: isolatedEnvironment }),
    log: (message) => logs.push(message),
  });
  return { pushed, logs };
};

beforeEach(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'jg-release-tag-'));
  const home = join(workDirectory, 'home');
  const originDirectory = join(workDirectory, 'origin.git');
  cloneDirectory = join(workDirectory, 'clone');
  releaseDirectory = join(workDirectory, 'release');
  await Promise.all([mkdir(home), mkdir(releaseDirectory)]);
  isolatedEnvironment = createIsolatedEnvironment(home);
  await git(['init', '--bare', '--initial-branch=main', originDirectory], workDirectory);
  await git(['clone', originDirectory, cloneDirectory], workDirectory);
  await writeFile(join(cloneDirectory, 'README.md'), '# sample\n');
  await git(['add', 'README.md']);
  await git([
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '-m',
    'initial',
  ]);
  await git(['push', 'origin', 'HEAD:refs/heads/main']);
  await writeReleaseManifest(releaseDirectory, [
    { name: 'jg-exception', version: '1.1.0', file: 'jg-exception-1.1.0.tgz', sha256: 'x' },
    { name: 'jg-utils', version: '1.2.0', file: 'jg-utils-1.2.0.tgz', sha256: 'x' },
  ]);
});

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

describe('tagRelease', () => {
  test('creates and pushes an annotated tag per published version where git has no identity', async () => {
    await expect(git(['tag', 'probe'])).resolves.toBe('');
    await expect(git(['tag', '--annotate', 'probe-annotated', '--message', 'x'])).rejects.toThrow();

    const { pushed } = await tag([
      { name: 'jg-exception', version: '1.1.0' },
      { name: 'jg-utils', version: '1.2.0' },
    ]);

    expect(pushed).toStrictEqual(['jg-exception-v1.1.0', 'jg-utils-v1.2.0']);
    expect(
      (await git(['ls-remote', '--tags', '--refs', 'origin']))
        .split('\n')
        .map((line) => line.split('\t')[1]),
    ).toStrictEqual(['refs/tags/jg-exception-v1.1.0', 'refs/tags/jg-utils-v1.2.0']);
    expect(await git(['cat-file', '-t', 'jg-utils-v1.2.0'])).toBe('tag');
    expect(
      await git([
        'for-each-ref',
        '--format=%(taggername) %(taggeremail)',
        'refs/tags/jg-utils-v1.2.0',
      ]),
    ).toBe('github-actions[bot] <41898208+github-actions[bot]@users.noreply.github.com>');
    expect(await git(['rev-parse', 'jg-utils-v1.2.0^{commit}'])).toBe(
      await git(['rev-parse', 'HEAD']),
    );
  });

  test('skips tags origin already has, so a re-run is safe', async () => {
    await tag([{ name: 'jg-exception', version: '1.1.0' }]);

    const { pushed, logs } = await tag([
      { name: 'jg-exception', version: '1.1.0' },
      { name: 'jg-utils', version: '1.2.0' },
    ]);

    expect(pushed).toStrictEqual(['jg-utils-v1.2.0']);
    expect(logs).toContain('Skipped jg-exception-v1.1.0: origin already has it');
  });

  test('pushes a tag a failed run created locally but never pushed', async () => {
    await git([
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'tag',
      '--annotate',
      'jg-utils-v1.2.0',
      '--message',
      'x',
    ]);

    const { pushed } = await tag([{ name: 'jg-utils', version: '1.2.0' }]);

    expect(pushed).toStrictEqual(['jg-utils-v1.2.0']);
    expect(await git(['ls-remote', '--tags', 'origin', 'refs/tags/jg-utils-v1.2.0'])).not.toBe('');
  });

  test('refuses a published version that is not part of the release', async () => {
    await expect(tag([{ name: 'jg-utils', version: '9.9.9' }])).rejects.toThrow(
      "The published version isn't part of the release: jg-utils@9.9.9",
    );
  });
});
