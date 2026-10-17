import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { buildPrecacheAssetPaths } from './precache.js';

let outDir: string;

/**
 * Writes files into the build directory.
 * @param paths The files' paths, relative to the build directory.
 * @returns A promise that resolves once the files are written.
 */
const writeFiles = async (paths: string[]): Promise<void> => {
  for (const path of paths) {
    await mkdir(dirname(join(outDir, path)), { recursive: true });
    await writeFile(join(outDir, path), path);
  }
};

beforeEach(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'jg-sw-precache-'));
});

afterEach(async () => {
  await rm(outDir, { recursive: true, force: true });
});

describe('buildPrecacheAssetPaths', () => {
  test('throws if an asset does not exist', async () => {
    await writeFiles(['index.html']);

    await expectToRejectCode(
      buildPrecacheAssetPaths(outDir, ['/index.html', '/app.js'], []),
      ERRORS.NOT_A_PATH_ELEMENT,
      `The asset '${join(outDir, 'app.js')}' is not a file or a directory.`,
    );
  });

  test('throws if an asset is a symbolic link', async () => {
    await writeFiles(['index.html', 'real.js']);
    await symlink(join(outDir, 'real.js'), join(outDir, 'app.js'));

    await expectToRejectCode(
      buildPrecacheAssetPaths(outDir, ['/index.html', '/app.js'], []),
      ERRORS.NOT_A_PATH_ELEMENT,
      `The asset '${join(outDir, 'app.js')}' is not a file or a directory.`,
    );
  });

  test('throws if an asset is outside outDir', async () => {
    await expectToRejectCode(
      buildPrecacheAssetPaths(outDir, ['/../secrets.txt'], []),
      ERRORS.NOT_A_PATH_ELEMENT,
      `The asset '/../secrets.txt' is outside the outDir '${outDir}'.`,
    );
  });

  test('returns an empty list if the precaching is not enabled', async () => {
    await expect(buildPrecacheAssetPaths(outDir, [], [])).resolves.toStrictEqual([]);
  });

  test('can build a basic list of assets without exclusions', async () => {
    await writeFiles([
      'index.html',
      'styles.css',
      'app.js',
      'img/some-other-img.jpg',
      'img/some-img.png',
      'img/icons/icon.svg',
    ]);

    await expect(
      buildPrecacheAssetPaths(outDir, ['/index.html', '/styles.css', '/app.js', '/img'], []),
    ).resolves.toStrictEqual([
      '/index.html',
      '/styles.css',
      '/app.js',
      '/img/icons/icon.svg',
      '/img/some-img.png',
      '/img/some-other-img.jpg',
    ]);
  });

  test('can build a basic list of assets with exclusions', async () => {
    await writeFiles([
      'index.html',
      'styles.css',
      'app.js',
      'img/some-img.png',
      'img/some-other-img.jpg',
    ]);

    await expect(
      buildPrecacheAssetPaths(
        outDir,
        ['/index.html', '/styles.css', '/app.js', '/img'],
        ['some-other-img.jpg'],
      ),
    ).resolves.toStrictEqual(['/index.html', '/styles.css', '/app.js', '/img/some-img.png']);
  });

  test('ignores an explicitly included file when its name is excluded', async () => {
    await writeFiles(['app.js']);

    await expect(buildPrecacheAssetPaths(outDir, ['/app.js'], ['app.js'])).resolves.toStrictEqual(
      [],
    );
  });

  test('includes the application root only when explicitly configured', async () => {
    await expect(buildPrecacheAssetPaths(outDir, ['/'], [])).resolves.toStrictEqual(['/']);
  });

  test('does not implicitly include the application root for a directory', async () => {
    await writeFiles(['assets/app.js', 'assets/app.css']);

    await expect(buildPrecacheAssetPaths(outDir, ['/assets'], [])).resolves.toStrictEqual([
      '/assets/app.css',
      '/assets/app.js',
    ]);
  });

  test('removes duplicate paths produced by overlapping explicit inputs', async () => {
    await writeFiles(['assets/app.js']);

    await expect(
      buildPrecacheAssetPaths(outDir, ['/assets/app.js', '/assets', 'assets/app.js'], []),
    ).resolves.toStrictEqual(['/assets/app.js']);
  });

  test('turns paths without a leading slash into URL paths', async () => {
    await writeFiles(['app.js', 'assets/app.css']);

    await expect(buildPrecacheAssetPaths(outDir, ['app.js', 'assets/'], [])).resolves.toStrictEqual(
      ['/app.js', '/assets/app.css'],
    );
  });

  test('leaves out symbolic links inside directories', async () => {
    await writeFiles(['assets/app.js', 'outside.js']);
    await symlink(join(outDir, 'outside.js'), join(outDir, 'assets', 'linked.js'));

    await expect(buildPrecacheAssetPaths(outDir, ['/assets'], [])).resolves.toStrictEqual([
      '/assets/app.js',
    ]);
  });

  test('percent-encodes the characters that would end a URL path', async () => {
    await writeFiles(['assets/a#b.js', 'assets/c?d.js', 'assets/e%f.js', 'assets/g h.js']);

    await expect(buildPrecacheAssetPaths(outDir, ['/assets'], [])).resolves.toStrictEqual([
      '/assets/a%23b.js',
      '/assets/c%3Fd.js',
      '/assets/e%25f.js',
      '/assets/g h.js',
    ]);
  });
});
