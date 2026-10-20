// @vitest-environment node
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../../shared/index.js';

import { assertNoLinksBelow, getPathElement, pathExists } from './general.js';

describe('General Actions', () => {
  let root: string;

  // builds a path inside of the base directory, which each test starts without
  const p = (path?: string): string =>
    typeof path === 'string' ? join(root, 'fs-test-dir', path) : join(root, 'fs-test-dir');

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'jg-fs-'));
  });

  beforeEach(async () => {
    await rm(p(), { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('pathExists', () => {
    test('can determine if a path does not exist', async () => {
      expect(await pathExists(p())).toBe(false);
      expect(await pathExists(p('some-file.txt'))).toBe(false);
    });

    test('can determine if a path exists', async () => {
      await mkdir(p());
      expect(await pathExists(p())).toBe(true);
      await writeFile(p('some-file.txt'), 'Hello World!');
      expect(await pathExists(p('some-file.txt'))).toBe(true);
    });
  });

  describe('getPathElement', () => {
    test('resolves to null when a path element does not exist', async () => {
      expect(await getPathElement(p())).toBeNull();
      expect(await getPathElement(p('test-file.txt'))).toBeNull();
    });

    test("can read a directory's element", async () => {
      await mkdir(p());
      const el = await getPathElement(p());
      expect(el).toStrictEqual({
        path: p(),
        baseName: 'fs-test-dir',
        extName: '',
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        size: expect.any(Number) as number,
        creation: expect.any(Number) as number,
      });
    });

    test("can read a file's element", async () => {
      await mkdir(p());
      await writeFile(p('test-file.txt'), 'Hello World!!');
      const el = await getPathElement(p('test-file.txt'));
      expect(el).toStrictEqual({
        path: p('test-file.txt'),
        baseName: 'test-file.txt',
        extName: '.txt',
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 13,
        creation: expect.any(Number) as number,
      });
    });
  });

  describe('assertNoLinksBelow', () => {
    test('passes when every directory below the root is a real directory', async () => {
      await mkdir(p('docs/guides'), { recursive: true });

      await expect(assertNoLinksBelow(p(), p('docs/guides/install.md'))).resolves.toBeUndefined();
      await expect(assertNoLinksBelow(p(), p('README.md'))).resolves.toBeUndefined();
    });

    test('stops at the first directory that does not exist, which a write would create', async () => {
      await mkdir(p('docs'), { recursive: true });

      await expect(assertNoLinksBelow(p(), p('docs/new/deeper/file.md'))).resolves.toBeUndefined();
    });

    test('ignores a link at the path itself, and in the root', async () => {
      await mkdir(p('docs'), { recursive: true });
      await symlink(p('docs'), p('link'), 'junction');

      await expect(assertNoLinksBelow(p(), p('link'))).resolves.toBeUndefined();
      await expect(assertNoLinksBelow(p('link'), p('link/file.md'))).resolves.toBeUndefined();
    });

    test('throws PATH_NOT_CANONICAL for a directory below the root that is a link or a junction', async () => {
      await mkdir(p('outside'), { recursive: true });
      await mkdir(p('repo/docs'), { recursive: true });
      // a junction on Windows, which needs no privilege, and a symbolic link elsewhere
      await symlink(p('outside'), p('repo/docs/linked'), 'junction');

      await expectToRejectCode(
        assertNoLinksBelow(p('repo'), p('repo/docs/linked/file.md')),
        ERRORS.PATH_NOT_CANONICAL,
      );
    });

    test('throws NOT_A_DIRECTORY for a file in the way', async () => {
      await mkdir(p(), { recursive: true });
      await writeFile(p('docs'), 'a file');

      await expectToRejectCode(assertNoLinksBelow(p(), p('docs/guide.md')), ERRORS.NOT_A_DIRECTORY);
    });

    test.each([
      ['a path outside the root', '../elsewhere/file.md'],
      ['the root itself', '.'],
    ])('throws PATH_OUTSIDE_ROOT for %s', async (_, relativePath) => {
      await mkdir(p(), { recursive: true });

      await expectToRejectCode(
        assertNoLinksBelow(p(), join(p(), relativePath)),
        ERRORS.PATH_OUTSIDE_ROOT,
      );
    });
  });
});
