import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { cleanDist, copyAssets } from './utilities.ts';

const execFileAsync = promisify(execFile);

let workDirectory: string;
let packageDirectory: string;

// writes files relative to the fixture package, creating their directories
const writeFiles = async (files: Record<string, string>): Promise<void> => {
  for (const [path, content] of Object.entries(files)) {
    const target = join(packageDirectory, ...path.split('/'));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
};

// lists every file under a directory as sorted slash-separated relative paths
const listFiles = async (directory: string): Promise<string[]> =>
  (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) =>
      join(entry.parentPath, entry.name)
        .slice(directory.length + 1)
        .split(sep)
        .join('/'),
    )
    .sort();

// runs one of the build-tools scripts the way package scripts do, from the package directory
const runScript = async (
  script: string,
  args: string[] = [],
): Promise<{ exitCode: number; stderr: string }> => {
  try {
    const { stderr } = await execFileAsync(
      process.execPath,
      [join(import.meta.dirname, script), ...args],
      { cwd: packageDirectory },
    );
    return { exitCode: 0, stderr };
  } catch (error) {
    const failure = error as { code: number; stderr: string };
    return { exitCode: failure.code, stderr: failure.stderr };
  }
};

beforeEach(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'jg-build-tools-'));
  packageDirectory = join(workDirectory, 'package');
  await writeFiles({ 'package.json': '{}', 'src/index.ts': 'export {};\n' });
});

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

describe('cleanDist', () => {
  test('removes the build output and nothing else', async () => {
    await writeFiles({ 'dist/index.js': 'stale', 'dist/nested/old.js': 'stale' });

    await cleanDist(packageDirectory);

    expect(await listFiles(packageDirectory)).toStrictEqual(['package.json', 'src/index.ts']);
  });

  test('succeeds when there is no build output yet', async () => {
    await expect(cleanDist(packageDirectory)).resolves.toBeUndefined();
  });

  test('refuses a directory that is not a package', async () => {
    await mkdir(join(workDirectory, 'dist'));

    await expect(cleanDist(workDirectory)).rejects.toThrow(
      'The directory is not a package (no package.json)',
    );
    expect(await readdir(workDirectory)).toContain('dist');
  });
});

describe('copyAssets', () => {
  test('copies matching files to the same relative paths under dist', async () => {
    await writeFiles({
      'src/build/templates/base.sw.js': 'base',
      'src/build/templates/firebase.sw.js': 'firebase',
      'src/build/templates/notes.md': 'not copied',
      'src/build/index.ts': 'not copied',
    });

    expect(await copyAssets(packageDirectory, 'build/templates/*.js')).toStrictEqual([
      'build/templates/base.sw.js',
      'build/templates/firebase.sw.js',
    ]);
    expect(await listFiles(join(packageDirectory, 'dist'))).toStrictEqual([
      'build/templates/base.sw.js',
      'build/templates/firebase.sw.js',
    ]);
    expect(
      await readFile(join(packageDirectory, 'dist', 'build', 'templates', 'base.sw.js'), 'utf8'),
    ).toBe('base');
  });

  test('fails when nothing matches, so a renamed asset never goes missing silently', async () => {
    await expect(copyAssets(packageDirectory, 'templates/*.js')).rejects.toThrow(
      'No files in src match the asset pattern: templates/*.js',
    );
  });

  test.each([
    ['../package.json'],
    ['build/../../secret.txt'],
    [join(sep, 'etc', 'passwd')],
    ['  '],
  ])('copyAssets(%s) -> rejects a pattern outside src', async (pattern) => {
    await expect(copyAssets(packageDirectory, pattern)).rejects.toThrow(
      'The asset pattern must be a relative path inside src',
    );
  });

  test('refuses a directory that is not a package', async () => {
    await expect(copyAssets(workDirectory, '*.ts')).rejects.toThrow(
      'The directory is not a package (no package.json)',
    );
  });
});

describe('command-line scripts', () => {
  test('clean-dist removes the working package build output', async () => {
    await writeFiles({ 'dist/index.js': 'stale' });

    expect(await runScript('clean-dist.ts')).toStrictEqual({ exitCode: 0, stderr: '' });
    expect(await listFiles(packageDirectory)).toStrictEqual(['package.json', 'src/index.ts']);
  });

  test('clean-dist rejects arguments it does not take', async () => {
    const { exitCode, stderr } = await runScript('clean-dist.ts', ['--force']);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("Unknown option '--force'");
  });

  test('copy-assets copies the glob given as its only argument', async () => {
    await writeFiles({ 'src/templates/base.sw.js': 'base' });

    expect(await runScript('copy-assets.ts', ['templates/*.js'])).toStrictEqual({
      exitCode: 0,
      stderr: '',
    });
    expect(await listFiles(join(packageDirectory, 'dist'))).toStrictEqual(['templates/base.sw.js']);
  });

  test.each([[[]], [['a/*.js', 'b/*.js']]])(
    'copy-assets(%o) -> prints its usage and fails',
    async (args) => {
      const { exitCode, stderr } = await runScript('copy-assets.ts', args);

      expect(exitCode).toBe(1);
      expect(stderr).toContain('Usage: copy-assets.ts <glob relative to src>');
    },
  );
});
