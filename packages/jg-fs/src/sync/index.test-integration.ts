import { expectToThrowCode } from 'jg-exception/testing';
import { describe, afterAll, beforeEach, test, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ERRORS } from '../shared/index.js';
import {
  deleteDirectory,
  pathExists,
  createDirectory,
  getPathElement,
  writeTextFile,
  isDirectory,
  createDirectorySymLink,
  isFile,
  createFileSymLink,
  deleteFile,
  readTextFile,
  writeJsonFile,
  readJsonFile,
  copyFile,
  copyDirectory,
  readDirectory,
  readBufferFile,
  writeBufferFile,
  getDirectoryElements,
  isPathWithin,
  writeFileAtomic,
  writeFileAtomicIfUnchanged,
  readBoundedFile,
  writeFile,
  assertNoLinksBelow,
} from './index.js';

/* ************************************************************************************************
 *                                           CONSTANTS                                            *
 ************************************************************************************************ */

// a temporary directory the tests work in, removed after the last test
const TEMP_ROOT = mkdtempSync(join(tmpdir(), 'jg-fs-sync-'));

// the base path that will be used for the tests
const BASE_PATH = join(TEMP_ROOT, 'fs-test-dir');

/* ************************************************************************************************
 *                                            HELPERS                                             *
 ************************************************************************************************ */

// builds a path inside of the base path
const p = (path?: string): string => (typeof path === 'string' ? join(BASE_PATH, path) : BASE_PATH);

// whether the tests run on Windows, where POSIX permissions, FIFOs and O_NOFOLLOW don't apply
const IS_WINDOWS = process.platform === 'win32';

// reads the permission bits of a path
const permissionBits = (path: string): number => statSync(path).mode & 0o777;

// lists the temporary files writeFileAtomic left in a directory
const listTemporaryFiles = (path: string): string[] =>
  readdirSync(path).filter((name) => name.endsWith('.tmp'));

/* ************************************************************************************************
 *                                             TESTS                                              *
 ************************************************************************************************ */
describe('Filesystem', () => {
  afterAll(() => {
    rmSync(TEMP_ROOT, { recursive: true, force: true });
  });

  beforeEach(() => {
    deleteDirectory(p());
  });

  /* **********************************************************************************************
   *                                        GENERAL ACTIONS                                        *
   *********************************************************************************************** */
  describe('General Actions', () => {
    describe('pathExists', () => {
      test('can determine if a path does not exist', () => {
        expect(pathExists(p())).toBeFalsy();
        expect(pathExists(p('some-file.txt'))).toBeFalsy();
      });

      test('can determine if a path exists', () => {
        createDirectory(p());
        expect(pathExists(p())).toBeTruthy();
        writeTextFile(p('some-file.txt'), 'Hello World!');
        expect(pathExists(p('some-file.txt'))).toBeTruthy();
      });
    });

    describe('getPathElement', () => {
      test('returns null when a path element does not exist', () => {
        expect(getPathElement(p())).toBeNull();
        expect(getPathElement(p('test-file.txt'))).toBeNull();
      });

      test("can read a directory's element", () => {
        createDirectory(p());
        const el = getPathElement(p());
        expect(el).not.toBeNull();
        expect(el!.baseName).toBe('fs-test-dir');
        expect(el!.path).toBe(p());
        expect(typeof el!.creation).toBe('number');
        expect(el!.extName).toBe('');
        expect(el!.isDirectory).toBeTruthy();
        expect(el!.isFile).toBeFalsy();
        expect(el!.isSymbolicLink).toBeFalsy();
        expect(typeof el!.size).toBe('number');
      });

      test("can read a file's element", () => {
        createDirectory(p());
        writeTextFile(p('test-file.txt'), 'Hello World!!');
        const el = getPathElement(p('test-file.txt'));
        expect(el).not.toBeNull();
        expect(el!.baseName).toBe('test-file.txt');
        expect(el!.path).toBe(p('test-file.txt'));
        expect(typeof el!.creation).toBe('number');
        expect(el!.extName).toBe('.txt');
        expect(el!.isDirectory).toBeFalsy();
        expect(el!.isFile).toBeTruthy();
        expect(el!.isSymbolicLink).toBeFalsy();
        expect(typeof el!.size).toBe('number');
      });
    });

    describe('isPathWithin', () => {
      test.each([
        ['/data/app', '/data/app', true],
        ['/data/app', '/data/app/logs/today.log', true],
        ['/data/app', '/data/app/..cache', true],
        ['/data/app', '/data/app/../secrets', false],
        ['/data/app', '/data/application', false],
        ['/data/app', '/data', false],
        ['data/app', 'data/app/file.txt', true],
        ['data/app', './data/app/./file.txt', true],
        ['data/app', 'data/other', false],
      ])('isPathWithin(%s, %s) -> %s', (rootPath, targetPath, expected) => {
        expect(isPathWithin(rootPath, targetPath)).toBe(expected);
      });

      test('compares relative and absolute paths through the working directory', () => {
        expect(isPathWithin(p(), resolve(p('nested/file.txt')))).toBe(true);
      });
    });
  });

  /* **********************************************************************************************
   *                                      DIRECTORY ACTIONS                                        *
   *********************************************************************************************** */
  describe('Directory Actions', () => {
    describe('isDirectory', () => {
      test('can determine if a path is a directory', () => {
        expect(isDirectory(p())).toBeFalsy();
        writeTextFile(p('some-file.txt'), 'Hello world!');
        expect(isDirectory(p())).toBeTruthy();
        expect(pathExists(p('some-file.txt'))).toBeTruthy();
        expect(isDirectory(p('some-file.txt'))).toBeFalsy();
      });
    });

    describe('createDirectory & deleteDirectory', () => {
      test('can create, read and delete a directory', () => {
        expect(pathExists(p())).toBeFalsy();
        createDirectory(p());
        expect(pathExists(p())).toBeTruthy();
        deleteDirectory(p());
        expect(pathExists(p())).toBeFalsy();
      });

      test('keeps an existing directory and its contents', () => {
        writeTextFile(p('test-dir/kept.txt'), 'kept');
        createDirectory(p('test-dir'));
        expect(readTextFile(p('test-dir/kept.txt'))).toBe('kept');
      });

      test('throws when something other than a directory exists at the path', () => {
        writeTextFile(p('test-dir'), 'a file');
        expectToThrowCode(() => createDirectory(p('test-dir')), ERRORS.DIRECTORY_ALREADY_EXISTS);
        expectToThrowCode(
          () => createDirectory(p('test-dir'), true),
          ERRORS.DIRECTORY_ALREADY_EXISTS,
        );
      });

      test('can create a directory on top of another if the deleteIfExists arg is provided', () => {
        createDirectory(p('test-dir'));
        expect(() => createDirectory(p('test-dir'), true)).not.toThrowError();
      });
    });

    describe('copyDirectory', () => {
      test('throws if the source directory does not exist', () => {
        expectToThrowCode(
          () => copyDirectory(p('dir-a'), p('dir-b')),
          ERRORS.NON_EXISTENT_DIRECTORY,
        );
      });

      test('can copy a directory with some files and sub directories in it', () => {
        writeTextFile(p('dir-a/file-a.txt'), 'This is file a!');
        writeTextFile(p('dir-a/file-b.txt'), 'This is file b!');
        writeTextFile(p('dir-a/b/file-ab.txt'), 'This is file ab!');
        writeJsonFile(p('dir-a/b/c/file-abc.json'), {
          name: 'file-abc.json',
          description: 'This is file abc!',
        });

        copyDirectory(p('dir-a'), p('dir-b'));
        expect(isDirectory(p('dir-b'))).toBeTruthy();
        expect(readTextFile(p('dir-b/file-a.txt'))).toBe('This is file a!');
        expect(readTextFile(p('dir-b/file-b.txt'))).toBe('This is file b!');
        expect(isDirectory(p('dir-b/b'))).toBeTruthy();
        expect(readTextFile(p('dir-b/b/file-ab.txt'))).toBe('This is file ab!');
        expect(isDirectory(p('dir-b/b/c'))).toBeTruthy();
        expect(readJsonFile(p('dir-b/b/c/file-abc.json'))).toStrictEqual({
          name: 'file-abc.json',
          description: 'This is file abc!',
        });
      });

      test('can copy a directory with some files in it, overriding the destination', () => {
        writeTextFile(p('dir-a/file-a.txt'), 'This is file a!');
        writeTextFile(p('dir-a/file-b.txt'), 'This is file b!');
        writeTextFile(p('dir-b/file-a.txt'), 'This is file ba!');
        writeTextFile(p('dir-b/file-b.txt'), 'This is file bb!');

        copyDirectory(p('dir-a'), p('dir-b'));
        expect(readTextFile(p('dir-b/file-a.txt'))).toBe('This is file a!');
        expect(readTextFile(p('dir-b/file-b.txt'))).toBe('This is file b!');
      });
    });

    describe('createDirectorySymLink', () => {
      test('can create a symbolic link for a directory', () => {
        createDirectory(p('test-dir'));
        let el = getPathElement(p('test-dir'));
        expect(el!.isSymbolicLink).toBeFalsy();
        createDirectorySymLink(p('test-dir'), p('test-dir-symlink'));
        el = getPathElement(p('test-dir'));
        expect(el!.isSymbolicLink).toBeFalsy();
        el = getPathElement(p('test-dir-symlink'));
        expect(el!.isSymbolicLink).toBeTruthy();
      });

      test('throws if the target directory does not exist', () => {
        expectToThrowCode(
          () => createDirectorySymLink(p('test-dir'), p('test-dir-symlink')),
          ERRORS.NON_EXISTENT_DIRECTORY,
        );
      });

      test('throws if the target directory is not a directory', () => {
        writeTextFile(p('some-file.txt'), 'Hello World!');
        expectToThrowCode(
          () => createDirectorySymLink(p('some-file.txt'), p('test-dir-symlink')),
          ERRORS.NOT_A_DIRECTORY,
        );
      });
    });

    describe('readDirectory', () => {
      test('throws if the directory doesnt exist', () => {
        expectToThrowCode(() => readDirectory(p()), ERRORS.NON_EXISTENT_DIRECTORY);
      });

      test('can read all the contents of a directory', () => {
        writeTextFile(p('file-01.txt'), 'Hello There!! 01');
        writeTextFile(p('file-02.txt'), 'Hello There!! 02');
        writeJsonFile(p('file-03.json'), { hello: 'World' });
        writeTextFile(p('inner/file-01.txt'), 'Hello There!! inner/01');
        writeTextFile(p('inner/inner-01.txt'), 'Hello There!! inner/01');
        writeJsonFile(p('inner/inner-02.json'), { foo: 'bar' });
        createDirectory(p('inner/inner2'));
        expect(readDirectory(p(), true)).toEqual([
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
      test('throws if attempting to read a non-existent directory', () => {
        expectToThrowCode(() => getDirectoryElements(p()), ERRORS.NON_EXISTENT_DIRECTORY);
      });

      test('reading an empty directory returns empty element lists', () => {
        createDirectory(p());
        expect(getDirectoryElements(p())).toStrictEqual({
          directories: [],
          files: [],
          symbolicLinks: [],
        });
      });

      test('can read the directory elements separated by directories, files & symlinks', () => {
        createDirectory(p('some-dir'));
        createDirectory(p('another-dir'));
        createDirectorySymLink(p('some-dir'), p('some-dir-sl'));
        writeTextFile(p('afile.txt'), 'Hello there!');
        writeJsonFile(p('aafile.json'), { foo: 'bar' });
        createFileSymLink(p('aafile.json'), p('aafile-sl.json'));
        expect(getDirectoryElements(p())).toStrictEqual({
          directories: [getPathElement(p('another-dir')), getPathElement(p('some-dir'))],
          files: [getPathElement(p('aafile.json')), getPathElement(p('afile.txt'))],
          symbolicLinks: [getPathElement(p('aafile-sl.json')), getPathElement(p('some-dir-sl'))],
        });
      });

      test('can filter files by any number of extensions', () => {
        writeTextFile(p('afile.txt'), 'Hello there!');
        writeJsonFile(p('abfile.json'), { baz: 'foo' });
        writeJsonFile(p('aafile.json'), { foo: 'bar' });
        writeTextFile(p('ajsfile.js'), "console.log('Hello JS World!')");
        writeTextFile(p('atsfile.ts'), "console.log('Hello TS World!')");
        expect(getDirectoryElements(p(), { includeExts: ['.json', '.ts'] })).toStrictEqual({
          directories: [],
          files: [
            getPathElement(p('aafile.json')),
            getPathElement(p('abfile.json')),
            getPathElement(p('atsfile.ts')),
          ],
          symbolicLinks: [],
        });
      });
    });
  });

  /* **********************************************************************************************
   *                                          FILE ACTIONS                                         *
   *********************************************************************************************** */
  describe('File Actions', () => {
    describe('isFile', () => {
      test('can determine if a path is a file', () => {
        expect(isFile(p())).toBeFalsy();
        createDirectory(p());
        expect(isFile(p())).toBeFalsy();
        expect(isFile(p('some-file.txt'))).toBeFalsy();
        writeTextFile(p('some-file.txt'), 'Hello World!');
        expect(isFile(p('some-file.txt'))).toBeTruthy();
      });
    });

    describe('writeTextFile & readTextFile', () => {
      test('writes an empty string as an empty file', () => {
        writeTextFile(p('file.txt'), '');
        expect(readFileSync(p('file.txt'), 'utf-8')).toBe('');
      });

      test('rejects text that is not a string', () => {
        expectToThrowCode(
          () => writeTextFile(p('file.txt'), 123 as never),
          ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
        );
      });

      test('can write and read a text file', () => {
        writeTextFile(p('file.txt'), 'Hello World!');
        expect(readTextFile(p('file.txt'))).toBe('Hello World!');
      });

      test('attempting to read a text file that doesnt exist throws an error', () => {
        expectToThrowCode(() => readTextFile(p('file.txt')), ERRORS.NON_EXISTENT_FILE);
      });

      test('reads an empty text file as an empty string', () => {
        createDirectory(p());
        writeFileSync(p('file.txt'), '', { encoding: 'utf-8' });
        expect(readTextFile(p('file.txt'))).toBe('');
      });
    });

    describe('writeJsonFile & readJsonFile', () => {
      test('attempting to write an empty or invalid file throws an error', () => {
        expectToThrowCode(
          () => writeJsonFile(p('file.json'), ''),
          ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
        );
      });

      test('can write and read a JSON file by providing a string', () => {
        writeJsonFile(p('file.json'), JSON.stringify({ foo: 'bar', baz: true, tan: 123 }));
        expect(readJsonFile(p('file.json'))).toStrictEqual({ foo: 'bar', baz: true, tan: 123 });
      });

      test('can write and read a JSON file by providing an object', () => {
        writeJsonFile(p('file.json'), { foo: 'bar', baz: true, tan: 123 });
        expect(readJsonFile(p('file.json'))).toStrictEqual({ foo: 'bar', baz: true, tan: 123 });
      });

      test('attempting to read a JSON file that doesnt exist throws an error', () => {
        expectToThrowCode(() => readJsonFile(p('file.json')), ERRORS.NON_EXISTENT_FILE);
      });

      test('attempting to read an empty/invalid json file throws an error', () => {
        createDirectory(p());
        writeFileSync(p('file.json'), '', { encoding: 'utf-8' });
        expectToThrowCode(
          () => readJsonFile(p('file.json')),
          ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
        );
      });
    });

    describe('writeBufferFile & readBufferFile', () => {
      test('attempting to write an empty or invalid file throws an error', () => {
        expectToThrowCode(
          // @ts-expect-error: passes what untyped JavaScript callers can
          () => writeBufferFile(p('file'), undefined),
          ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
        );
      });

      test('can write and read a Buffer file', () => {
        const file = Buffer.from('This is a Buffer File!');
        writeBufferFile(p('file'), file);
        expect(readBufferFile(p('file')).toString()).toBe('This is a Buffer File!');
      });

      test('attempting to read a Buffer file that doesnt exist throws an error', () => {
        expectToThrowCode(() => readBufferFile(p('file')), ERRORS.NON_EXISTENT_FILE);
      });

      test('reads an empty file as an empty Buffer, and writes an empty Buffer', () => {
        createDirectory(p());
        writeFileSync(p('file'), '', { encoding: 'utf-8' });
        expect(readBufferFile(p('file'))).toStrictEqual(Buffer.alloc(0));
        writeBufferFile(p('empty'), Buffer.alloc(0));
        expect(readFileSync(p('empty'))).toStrictEqual(Buffer.alloc(0));
      });
    });

    describe('copyFile', () => {
      test('throws if the source file does not exist', () => {
        expectToThrowCode(() => copyFile(p('file.txt'), p('file-b.txt')), ERRORS.NON_EXISTENT_FILE);
      });

      test('can copy a text file from a to b', () => {
        writeTextFile(p('file-a.txt'), 'This is file-a.txt!');
        copyFile(p('file-a.txt'), p('file-b.txt'));
        expect(readTextFile(p('file-b.txt'))).toBe('This is file-a.txt!');
      });

      test('can copy a JSON file from a to b', () => {
        writeJsonFile(p('file-a.json'), { id: 1, name: 'jess' });
        copyFile(p('file-a.json'), p('file-b.json'));
        expect(readJsonFile(p('file-b.json'))).toStrictEqual({ id: 1, name: 'jess' });
      });

      test('can override the destination path if it already exists', () => {
        writeTextFile(p('file-a.txt'), 'This is file-a.txt!');
        expect(readTextFile(p('file-a.txt'))).toBe('This is file-a.txt!');
        writeTextFile(p('file-b.txt'), 'This is file-b.txt!');
        expect(readTextFile(p('file-b.txt'))).toBe('This is file-b.txt!');
        copyFile(p('file-b.txt'), p('file-a.txt'));
        expect(readTextFile(p('file-a.txt'))).toBe('This is file-b.txt!');
      });
    });

    describe('deleteFile', () => {
      test('can delete a file', () => {
        writeTextFile(p('some-file.txt'), 'Hello World!');
        expect(isFile(p('some-file.txt'))).toBeTruthy();
        deleteFile(p('some-file.txt'));
        expect(isFile(p('some-file.txt'))).toBeFalsy();
      });

      test('throws if the file does not exist', () => {
        expectToThrowCode(() => deleteFile(p('some-file.txt')), ERRORS.NON_EXISTENT_FILE);
      });

      test('throws if attempting to delete a directory', () => {
        createDirectory(p());
        expectToThrowCode(() => deleteFile(p()), ERRORS.NOT_A_FILE);
      });

      test('throws if attempting to delete a symlink', () => {
        writeTextFile(p('some-file.txt'), 'Hello World!');
        createFileSymLink(p('some-file.txt'), p('some-file-symlink.txt'));
        expectToThrowCode(() => deleteFile(p('some-file-symlink.txt')), ERRORS.NOT_A_FILE);
      });
    });

    describe('createFileSymLink', () => {
      test('can create a symbolic link for a file', () => {
        writeTextFile(p('test-file.txt'), 'Hello World!');
        let el = getPathElement(p('test-file.txt'));
        expect(el!.isSymbolicLink).toBeFalsy();
        createFileSymLink(p('test-file.txt'), p('test-file-symlink.txt'));
        el = getPathElement(p('test-file.txt'));
        expect(el!.isSymbolicLink).toBeFalsy();
        el = getPathElement(p('test-file-symlink.txt'));
        expect(el!.isSymbolicLink).toBeTruthy();
      });

      test('throws if the target file does not exist', () => {
        expectToThrowCode(
          () => createFileSymLink(p('test-file.txt'), p('test-file-symlink.txt')),
          ERRORS.NON_EXISTENT_FILE,
        );
      });

      test('throws if the target file is not a file', () => {
        createDirectory(p('some-file'));
        expectToThrowCode(
          () => createFileSymLink(p('some-file'), p('some-file.txt')),
          ERRORS.NOT_A_FILE,
        );
      });
    });

    describe('writeFileAtomic', () => {
      test('creates missing parent directories and writes the content', () => {
        writeFileAtomic(p('nested/dir/file.txt'), 'Hello World!');
        expect(readFileSync(p('nested/dir/file.txt'), 'utf-8')).toBe('Hello World!');
        expect(listTemporaryFiles(p('nested/dir'))).toStrictEqual([]);
      });

      test('replaces existing content and accepts bytes and empty content', () => {
        writeTextFile(p('file.bin'), 'old content');
        writeFileAtomic(p('file.bin'), Buffer.from([1, 2, 3]));
        expect(readFileSync(p('file.bin'))).toStrictEqual(Buffer.from([1, 2, 3]));
        writeFileAtomic(p('file.bin'), '');
        expect(readFileSync(p('file.bin'), 'utf-8')).toBe('');
        expect(listTemporaryFiles(p())).toStrictEqual([]);
      });

      test('writes a destination whose name is 255 bytes long', () => {
        const name = `${'a'.repeat(251)}.txt`;
        writeFileAtomic(p(name), 'Hello World!');
        expect(readFileSync(p(name), 'utf-8')).toBe('Hello World!');
      });

      test.skipIf(IS_WINDOWS)('applies an explicit mode', () => {
        writeFileAtomic(p('secret.txt'), 'Hello World!', 0o640);
        expect(permissionBits(p('secret.txt'))).toBe(0o640);
      });

      test.skipIf(IS_WINDOWS)('keeps the permissions of a replaced file without a mode', () => {
        writeTextFile(p('secret.txt'), 'old content');
        chmodSync(p('secret.txt'), 0o600);
        writeFileAtomic(p('secret.txt'), 'new content');
        expect(permissionBits(p('secret.txt'))).toBe(0o600);
        expect(readFileSync(p('secret.txt'), 'utf-8')).toBe('new content');
      });

      test.skipIf(IS_WINDOWS)('gives a new file the same permissions as writeFile', () => {
        writeFile(p('plain.txt'), 'Hello World!');
        writeFileAtomic(p('atomic.txt'), 'Hello World!');
        expect(permissionBits(p('atomic.txt'))).toBe(permissionBits(p('plain.txt')));
      });

      test('removes the temporary file and rethrows when the rename fails', () => {
        createDirectory(p('target'));
        expect(() => writeFileAtomic(p('target'), 'Hello World!')).toThrowError();
        expect(isDirectory(p('target'))).toBe(true);
        expect(listTemporaryFiles(p())).toStrictEqual([]);
      });
    });

    describe('readBoundedFile', () => {
      test('reads content of exactly maxBytes bytes', () => {
        writeTextFile(p('file.txt'), 'abcd');
        expect(readBoundedFile(p('file.txt'), 4)).toStrictEqual(Buffer.from('abcd'));
      });

      test('reads an empty file', () => {
        writeFile(p('empty.txt'), '');
        expect(readBoundedFile(p('empty.txt'), 4)).toStrictEqual(Buffer.alloc(0));
      });

      test('reads content larger than one read chunk', () => {
        const content = Buffer.alloc(200_000, 7);
        writeFile(p('large.bin'), content);
        // Buffer.equals compares the bytes exactly, without a deep equality's per-index cost
        expect(readBoundedFile(p('large.bin'), 200_000).equals(content)).toBe(true);
      });

      test('throws when the content exceeds maxBytes', () => {
        writeTextFile(p('file.txt'), 'abcde');
        expectToThrowCode(() => readBoundedFile(p('file.txt'), 4), ERRORS.FILE_TOO_LARGE);
      });

      test('throws when the path does not exist', () => {
        expectToThrowCode(() => readBoundedFile(p('missing.txt'), 4), ERRORS.NON_EXISTENT_FILE);
      });

      test('throws when the path is a directory', () => {
        createDirectory(p('some-dir'));
        expectToThrowCode(() => readBoundedFile(p('some-dir'), 4), ERRORS.NOT_A_FILE);
      });

      test.skipIf(IS_WINDOWS)('throws when the final path component is a symbolic link', () => {
        writeTextFile(p('file.txt'), 'abcd');
        createFileSymLink(resolve(p('file.txt')), p('link.txt'));
        expectToThrowCode(
          () => readBoundedFile(p('link.txt'), 4),
          ERRORS.NOT_A_FILE,
          'is a symbolic link',
        );
      });

      test.skipIf(IS_WINDOWS)('throws for a named pipe without blocking', () => {
        createDirectory(p());
        execFileSync('mkfifo', [p('pipe')]);
        expectToThrowCode(() => readBoundedFile(p('pipe'), 4), ERRORS.NOT_A_FILE);
      });

      test.skipIf(IS_WINDOWS)('follows symbolic links in parent directories', () => {
        writeTextFile(p('real/file.txt'), 'abcd');
        symlinkSync(resolve(p('real')), p('linked'), 'dir');
        expect(readBoundedFile(p('linked/file.txt'), 4)).toStrictEqual(Buffer.from('abcd'));
      });
    });
  });

  describe('Conditional writes and link checks', () => {
    test('writeJsonFile ends a stringified value with a line feed', () => {
      writeJsonFile(p('object.json'), { a: 1 });

      expect(readFileSync(p('object.json'), 'utf-8')).toBe('{\n  "a": 1\n}\n');
    });

    test('writeFileAtomicIfUnchanged replaces unchanged bytes, and creates a missing file', () => {
      writeTextFile(p('config.txt'), 'before');
      if (!IS_WINDOWS) {
        chmodSync(p('config.txt'), 0o640);
      }

      writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'));
      writeFileAtomicIfUnchanged(p('new.txt'), 'created', null);

      expect(readFileSync(p('config.txt'), 'utf-8')).toBe('after');
      expect(readFileSync(p('new.txt'), 'utf-8')).toBe('created');
      if (!IS_WINDOWS) {
        expect(permissionBits(p('config.txt'))).toBe(0o640);
      }
      expect(listTemporaryFiles(p())).toStrictEqual([]);
    });

    test('writeFileAtomicIfUnchanged creates a private file with an explicit mode', () => {
      writeFileAtomicIfUnchanged(p('secret.txt'), 'created', null, 0o600);

      expect(readFileSync(p('secret.txt'), 'utf-8')).toBe('created');
      if (!IS_WINDOWS) {
        expect(permissionBits(p('secret.txt'))).toBe(0o600);
      }
      expect(listTemporaryFiles(p())).toStrictEqual([]);
    });

    test.each([0o640, 0o644, 0o666])(
      'writeFileAtomicIfUnchanged replaces mode %i with explicit private permissions',
      (mode) => {
        writeTextFile(p('secret.txt'), 'before');
        if (!IS_WINDOWS) {
          chmodSync(p('secret.txt'), mode);
        }

        writeFileAtomicIfUnchanged(p('secret.txt'), 'after', Buffer.from('before'), 0o600);

        expect(readFileSync(p('secret.txt'), 'utf-8')).toBe('after');
        if (!IS_WINDOWS) {
          expect(permissionBits(p('secret.txt'))).toBe(0o600);
        }
        expect(listTemporaryFiles(p())).toStrictEqual([]);
      },
    );

    test('writeFileAtomicIfUnchanged throws FILE_CHANGED, leaving the file, for other bytes or a file that appeared', () => {
      writeTextFile(p('config.txt'), 'edited');
      if (!IS_WINDOWS) {
        chmodSync(p('config.txt'), 0o644);
      }

      expectToThrowCode(
        () => writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'), 0o600),
        ERRORS.FILE_CHANGED,
      );
      expectToThrowCode(
        () => writeFileAtomicIfUnchanged(p('config.txt'), 'after', null, 0o600),
        ERRORS.FILE_CHANGED,
      );
      expect(readFileSync(p('config.txt'), 'utf-8')).toBe('edited');
      if (!IS_WINDOWS) {
        expect(permissionBits(p('config.txt'))).toBe(0o644);
      }
      expect(listTemporaryFiles(p())).toStrictEqual([]);
    });

    test('writeFileAtomicIfUnchanged refuses a missing file or directory without leaving temporary files', () => {
      createDirectory(p('directory'));

      expectToThrowCode(
        () => writeFileAtomicIfUnchanged(p('missing.txt'), 'after', Buffer.from('before'), 0o600),
        ERRORS.FILE_CHANGED,
      );
      expectToThrowCode(
        () => writeFileAtomicIfUnchanged(p('directory'), 'after', Buffer.from(''), 0o600),
        ERRORS.FILE_CHANGED,
      );
      expect(pathExists(p('missing.txt'))).toBe(false);
      expect(isDirectory(p('directory'))).toBe(true);
      expect(listTemporaryFiles(p())).toStrictEqual([]);
    });

    test.skipIf(IS_WINDOWS)(
      'writeFileAtomicIfUnchanged throws FILE_CHANGED for a symbolic link',
      () => {
        writeTextFile(p('target.txt'), 'before');
        symlinkSync(resolve(p('target.txt')), p('config.txt'));

        expectToThrowCode(
          () => writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'), 0o600),
          ERRORS.FILE_CHANGED,
        );
        expect(readFileSync(p('target.txt'), 'utf-8')).toBe('before');
        expect(listTemporaryFiles(p())).toStrictEqual([]);
      },
    );

    test('assertNoLinksBelow passes real and missing directories, and refuses a link or a junction', () => {
      createDirectory(p('repo/docs'));
      createDirectory(p('outside'));
      symlinkSync(resolve(p('outside')), p('repo/linked'), 'junction');

      expect(() => assertNoLinksBelow(p('repo'), p('repo/docs/new/file.md'))).not.toThrow();
      expectToThrowCode(
        () => assertNoLinksBelow(p('repo'), p('repo/linked/file.md')),
        ERRORS.PATH_NOT_CANONICAL,
      );
    });

    test('assertNoLinksBelow refuses a file in the way, and a path outside the root', () => {
      writeTextFile(p('repo/docs'), 'a file');

      expectToThrowCode(
        () => assertNoLinksBelow(p('repo'), p('repo/docs/file.md')),
        ERRORS.NOT_A_DIRECTORY,
      );
      expectToThrowCode(
        () => assertNoLinksBelow(p('repo'), p('elsewhere/file.md')),
        ERRORS.PATH_OUTSIDE_ROOT,
      );
    });
  });
});
