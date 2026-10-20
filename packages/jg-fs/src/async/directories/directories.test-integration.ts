import { expectToRejectCode } from 'jg-exception/testing';
// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { getPathElement, pathExists } from '../general/index.js';
import {
  createFileSymLink,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from '../files/index.js';
import { ERRORS } from '../../shared/index.js';

import {
  copyDirectory,
  createDirectory,
  createDirectorySymLink,
  deleteDirectory,
  getDirectoryElements,
  isDirectory,
  readDirectory,
} from './directories.js';

describe('Directory Actions', () => {
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

  describe('isDirectory', () => {
    test('can determine if a path is a directory', async () => {
      expect(await isDirectory(p())).toBe(false);
      await writeTextFile(p('some-file.txt'), 'Hello world!');
      expect(await isDirectory(p())).toBe(true);
      expect(await pathExists(p('some-file.txt'))).toBe(true);
      expect(await isDirectory(p('some-file.txt'))).toBe(false);
    });
  });

  describe('createDirectory & deleteDirectory', () => {
    test('can create, read and delete a directory', async () => {
      expect(await pathExists(p())).toBe(false);
      await createDirectory(p());
      expect(await pathExists(p())).toBe(true);
      await deleteDirectory(p());
      expect(await pathExists(p())).toBe(false);
    });

    test('keeps an existing directory and its contents', async () => {
      await writeTextFile(p('test-dir/kept.txt'), 'kept');
      await createDirectory(p('test-dir'));
      expect(await readTextFile(p('test-dir/kept.txt'))).toBe('kept');
    });

    test('rejects when something other than a directory exists at the path', async () => {
      await writeTextFile(p('test-dir'), 'a file');
      await expectToRejectCode(createDirectory(p('test-dir')), ERRORS.DIRECTORY_ALREADY_EXISTS);
      await expectToRejectCode(
        createDirectory(p('test-dir'), true),
        ERRORS.DIRECTORY_ALREADY_EXISTS,
      );
    });

    test('can create a directory on top of another if deleteIfExists is provided', async () => {
      await writeTextFile(p('test-dir/old.txt'), 'old');
      await createDirectory(p('test-dir'), true);
      expect(await isDirectory(p('test-dir'))).toBe(true);
      expect(await pathExists(p('test-dir/old.txt'))).toBe(false);
    });

    test('deleting a directory that does not exist resolves', async () => {
      await expect(deleteDirectory(p('missing'))).resolves.toBeUndefined();
    });
  });

  describe('copyDirectory', () => {
    test('rejects if the source directory does not exist', async () => {
      await expectToRejectCode(
        copyDirectory(p('dir-a'), p('dir-b')),
        ERRORS.NON_EXISTENT_DIRECTORY,
      );
    });

    test('can copy a directory with some files and sub directories in it', async () => {
      await writeTextFile(p('dir-a/file-a.txt'), 'This is file a!');
      await writeTextFile(p('dir-a/file-b.txt'), 'This is file b!');
      await writeTextFile(p('dir-a/b/file-ab.txt'), 'This is file ab!');
      await writeJsonFile(p('dir-a/b/c/file-abc.json'), {
        name: 'file-abc.json',
        description: 'This is file abc!',
      });

      await copyDirectory(p('dir-a'), p('dir-b'));
      expect(await isDirectory(p('dir-b'))).toBe(true);
      expect(await readTextFile(p('dir-b/file-a.txt'))).toBe('This is file a!');
      expect(await readTextFile(p('dir-b/file-b.txt'))).toBe('This is file b!');
      expect(await readTextFile(p('dir-b/b/file-ab.txt'))).toBe('This is file ab!');
      expect(await readJsonFile(p('dir-b/b/c/file-abc.json'))).toStrictEqual({
        name: 'file-abc.json',
        description: 'This is file abc!',
      });
    });

    test('can copy a directory with some files in it, overriding the destination', async () => {
      await writeTextFile(p('dir-a/file-a.txt'), 'This is file a!');
      await writeTextFile(p('dir-b/file-a.txt'), 'This is file ba!');
      await writeTextFile(p('dir-b/file-c.txt'), 'This is file bc!');

      await copyDirectory(p('dir-a'), p('dir-b'));
      expect(await readTextFile(p('dir-b/file-a.txt'))).toBe('This is file a!');
      expect(await pathExists(p('dir-b/file-c.txt'))).toBe(false);
    });
  });

  describe('createDirectorySymLink', () => {
    test('can create a symbolic link for a directory', async () => {
      await createDirectory(p('test-dir'));
      await createDirectorySymLink(p('test-dir'), p('test-dir-symlink'));
      expect((await getPathElement(p('test-dir')))!.isSymbolicLink).toBe(false);
      expect((await getPathElement(p('test-dir-symlink')))!.isSymbolicLink).toBe(true);
    });

    test('rejects if the target directory does not exist', async () => {
      await expectToRejectCode(
        createDirectorySymLink(p('test-dir'), p('test-dir-symlink')),
        ERRORS.NON_EXISTENT_DIRECTORY,
      );
    });

    test('rejects if the target directory is not a directory', async () => {
      await writeTextFile(p('some-file.txt'), 'Hello World!');
      await expectToRejectCode(
        createDirectorySymLink(p('some-file.txt'), p('test-dir-symlink')),
        ERRORS.NOT_A_DIRECTORY,
      );
    });
  });

  describe('readDirectory', () => {
    test('rejects if the directory does not exist', async () => {
      await expectToRejectCode(readDirectory(p()), ERRORS.NON_EXISTENT_DIRECTORY);
    });

    test('can read the contents of a directory', async () => {
      await writeTextFile(p('file-01.txt'), 'Hello There!! 01');
      await writeTextFile(p('inner/file-01.txt'), 'Hello There!! inner/01');
      expect((await readDirectory(p())).sort()).toStrictEqual([p('file-01.txt'), p('inner')]);
    });

    test('can read all the contents of a directory recursively', async () => {
      await writeTextFile(p('file-01.txt'), 'Hello There!! 01');
      await writeTextFile(p('file-02.txt'), 'Hello There!! 02');
      await writeJsonFile(p('file-03.json'), { hello: 'World' });
      await writeTextFile(p('inner/file-01.txt'), 'Hello There!! inner/01');
      await writeTextFile(p('inner/inner-01.txt'), 'Hello There!! inner/01');
      await writeJsonFile(p('inner/inner-02.json'), { foo: 'bar' });
      await createDirectory(p('inner/inner2'));
      expect((await readDirectory(p(), true)).sort()).toStrictEqual([
        p('file-01.txt'),
        p('file-02.txt'),
        p('file-03.json'),
        p('inner'),
        p('inner/file-01.txt'),
        p('inner/inner-01.txt'),
        p('inner/inner-02.json'),
        p('inner/inner2'),
      ]);
    });
  });

  describe('getDirectoryElements', () => {
    test('rejects if attempting to read a non-existent directory', async () => {
      await expectToRejectCode(getDirectoryElements(p()), ERRORS.NON_EXISTENT_DIRECTORY);
    });

    test('reading an empty directory resolves to empty element lists', async () => {
      await createDirectory(p());
      expect(await getDirectoryElements(p())).toStrictEqual({
        directories: [],
        files: [],
        symbolicLinks: [],
      });
    });

    test('can read the directory elements separated by directories, files & symlinks', async () => {
      await createDirectory(p('some-dir'));
      await createDirectory(p('another-dir'));
      await createDirectorySymLink(p('some-dir'), p('some-dir-sl'));
      await writeTextFile(p('afile.txt'), 'Hello there!');
      await writeJsonFile(p('aafile.json'), { foo: 'bar' });
      await createFileSymLink(p('aafile.json'), p('aafile-sl.json'));
      expect(await getDirectoryElements(p())).toStrictEqual({
        directories: [await getPathElement(p('another-dir')), await getPathElement(p('some-dir'))],
        files: [await getPathElement(p('aafile.json')), await getPathElement(p('afile.txt'))],
        symbolicLinks: [
          await getPathElement(p('aafile-sl.json')),
          await getPathElement(p('some-dir-sl')),
        ],
      });
    });

    test('can filter files by any number of extensions and sort them', async () => {
      await writeTextFile(p('afile.txt'), 'Hello there!');
      await writeJsonFile(p('abfile.json'), { baz: 'foo' });
      await writeJsonFile(p('aafile.json'), { foo: 'bar' });
      await writeTextFile(p('ajsfile.js'), "console.log('Hello JS World!')");
      await writeTextFile(p('atsfile.ts'), "console.log('Hello TS World!')");
      expect(
        await getDirectoryElements(p(), { includeExts: ['.json', '.ts'], sortOrder: 'desc' }),
      ).toStrictEqual({
        directories: [],
        files: [
          await getPathElement(p('atsfile.ts')),
          await getPathElement(p('abfile.json')),
          await getPathElement(p('aafile.json')),
        ],
        symbolicLinks: [],
      });
    });
  });
});
