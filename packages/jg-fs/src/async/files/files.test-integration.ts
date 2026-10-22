import { expectToRejectCode } from 'jg-exception/testing';
// @vitest-environment node
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile as readRaw,
  rm,
  stat,
  symlink,
  writeFile as writeRaw,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createDirectory, isDirectory } from '../directories/index.js';
import { getPathElement } from '../general/index.js';
import { ERRORS } from '../../shared/index.js';

import {
  copyFile,
  createFileSymLink,
  deleteFile,
  isFile,
  readBoundedFile,
  readBufferFile,
  readFile,
  readJsonFile,
  readTextFile,
  writeBufferFile,
  writeFile,
  writeFileAtomic,
  writeFileAtomicIfUnchanged,
  writeJsonFile,
  writeTextFile,
} from './files.js';

// whether the tests run on Windows, where POSIX permissions, FIFOs and O_NOFOLLOW don't apply
const IS_WINDOWS = process.platform === 'win32';

describe('File Actions', () => {
  let root: string;

  // builds a path inside of the base directory, which each test starts without
  const p = (path?: string): string =>
    typeof path === 'string' ? join(root, 'fs-test-dir', path) : join(root, 'fs-test-dir');

  // reads the permission bits of a path
  const permissionBits = async (path: string): Promise<number> => (await stat(path)).mode & 0o777;

  // lists the temporary files writeFileAtomic left in a directory
  const listTemporaryFiles = async (path: string): Promise<string[]> =>
    (await readdir(path)).filter((name) => name.endsWith('.tmp'));

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'jg-fs-'));
  });

  beforeEach(async () => {
    await rm(p(), { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('isFile', () => {
    test('can determine if a path is a file', async () => {
      expect(await isFile(p())).toBe(false);
      await createDirectory(p());
      expect(await isFile(p())).toBe(false);
      expect(await isFile(p('some-file.txt'))).toBe(false);
      await writeTextFile(p('some-file.txt'), 'Hello World!');
      expect(await isFile(p('some-file.txt'))).toBe(true);
    });
  });

  describe('writeFile & readFile', () => {
    test('creates missing parent directories, also when called concurrently', async () => {
      await Promise.all([writeFile(p('a/b/one.txt'), 'one'), writeFile(p('a/b/two.txt'), 'two')]);
      expect(await readFile(p('a/b/one.txt'), 'utf-8')).toBe('one');
      expect(await readFile(p('a/b/two.txt'))).toStrictEqual(Buffer.from('two'));
    });

    test('rejects when reading a path that does not exist', async () => {
      await expectToRejectCode(readFile(p('missing.txt')), ERRORS.NON_EXISTENT_FILE);
    });
  });

  describe('writeTextFile & readTextFile', () => {
    test('writes an empty string as an empty file', async () => {
      await writeTextFile(p('file.txt'), '');
      expect(await readTextFile(p('file.txt'))).toBe('');
    });

    test('rejects text that is not a string', async () => {
      await expectToRejectCode(
        writeTextFile(p('file.txt'), 123 as never),
        ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
      );
    });

    test('can write and read a text file', async () => {
      await writeTextFile(p('file.txt'), 'Hello World!');
      expect(await readTextFile(p('file.txt'))).toBe('Hello World!');
    });

    test('attempting to read a text file that doesnt exist rejects', async () => {
      await expectToRejectCode(readTextFile(p('file.txt')), ERRORS.NON_EXISTENT_FILE);
    });

    test('reads an empty text file as an empty string', async () => {
      await mkdir(p());
      await writeRaw(p('file.txt'), '');
      expect(await readTextFile(p('file.txt'))).toBe('');
    });
  });

  describe('writeJsonFile & readJsonFile', () => {
    test('attempting to write an empty or invalid file rejects', async () => {
      await expectToRejectCode(
        writeJsonFile(p('file.json'), ''),
        ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
      );
      await expectToRejectCode(
        writeJsonFile(p('file.json'), { value: 1n }),
        ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
      );
    });

    test('can write and read a JSON file by providing a string', async () => {
      await writeJsonFile(p('file.json'), JSON.stringify({ foo: 'bar', baz: true, tan: 123 }));
      expect(await readJsonFile(p('file.json'))).toStrictEqual({ foo: 'bar', baz: true, tan: 123 });
    });

    test('can write and read a JSON file by providing an object', async () => {
      await writeJsonFile(p('file.json'), { foo: 'bar', baz: true, tan: 123 });
      expect(await readJsonFile(p('file.json'))).toStrictEqual({ foo: 'bar', baz: true, tan: 123 });
    });

    test('ends a stringified value with a line feed, and writes a string as given', async () => {
      await writeJsonFile(p('object.json'), { a: 1 });
      await writeJsonFile(p('string.json'), '{"a":1}');

      expect(await readRaw(p('object.json'), 'utf-8')).toBe('{\n  "a": 1\n}\n');
      expect(await readRaw(p('string.json'), 'utf-8')).toBe('{"a":1}');
    });

    test('attempting to read a JSON file that doesnt exist rejects', async () => {
      await expectToRejectCode(readJsonFile(p('file.json')), ERRORS.NON_EXISTENT_FILE);
    });

    test('attempting to read an invalid JSON file rejects', async () => {
      await writeTextFile(p('file.json'), '{ invalid');
      await expectToRejectCode(
        readJsonFile(p('file.json')),
        ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
      );
    });
  });

  describe('writeBufferFile & readBufferFile', () => {
    test('attempting to write an invalid Buffer rejects', async () => {
      await expectToRejectCode(
        writeBufferFile(p('file'), undefined as unknown as Buffer),
        ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
      );
    });

    test('can write and read a Buffer file', async () => {
      await writeBufferFile(p('file'), Buffer.from('This is a Buffer File!'));
      expect((await readBufferFile(p('file'))).toString()).toBe('This is a Buffer File!');
    });

    test('attempting to read a Buffer file that doesnt exist rejects', async () => {
      await expectToRejectCode(readBufferFile(p('file')), ERRORS.NON_EXISTENT_FILE);
    });

    test('reads an empty file as an empty Buffer, and writes an empty Buffer', async () => {
      await mkdir(p());
      await writeRaw(p('file'), '');
      expect(await readBufferFile(p('file'))).toStrictEqual(Buffer.alloc(0));
      await writeBufferFile(p('empty'), Buffer.alloc(0));
      expect(await readBufferFile(p('empty'))).toStrictEqual(Buffer.alloc(0));
    });
  });

  describe('copyFile', () => {
    test('rejects if the source file does not exist', async () => {
      await expectToRejectCode(copyFile(p('file.txt'), p('file-b.txt')), ERRORS.NON_EXISTENT_FILE);
    });

    test('can copy a file, overriding the destination if it exists', async () => {
      await writeTextFile(p('file-a.txt'), 'This is file-a.txt!');
      await writeTextFile(p('file-b.txt'), 'This is file-b.txt!');
      await copyFile(p('file-b.txt'), p('file-a.txt'));
      expect(await readTextFile(p('file-a.txt'))).toBe('This is file-b.txt!');
      await copyFile(p('file-a.txt'), p('file-c.txt'));
      expect(await readTextFile(p('file-c.txt'))).toBe('This is file-b.txt!');
    });
  });

  describe('deleteFile', () => {
    test('can delete a file', async () => {
      await writeTextFile(p('some-file.txt'), 'Hello World!');
      await deleteFile(p('some-file.txt'));
      expect(await isFile(p('some-file.txt'))).toBe(false);
    });

    test("rejects if the file does not exist, or if it isn't a file", async () => {
      await expectToRejectCode(deleteFile(p('some-file.txt')), ERRORS.NON_EXISTENT_FILE);
      await createDirectory(p());
      await expectToRejectCode(deleteFile(p()), ERRORS.NOT_A_FILE);
    });

    test('rejects if attempting to delete a symlink', async () => {
      await writeTextFile(p('some-file.txt'), 'Hello World!');
      await createFileSymLink(p('some-file.txt'), p('some-file-symlink.txt'));
      await expectToRejectCode(deleteFile(p('some-file-symlink.txt')), ERRORS.NOT_A_FILE);
    });
  });

  describe('createFileSymLink', () => {
    test('can create a symbolic link for a file', async () => {
      await writeTextFile(p('test-file.txt'), 'Hello World!');
      await createFileSymLink(p('test-file.txt'), p('test-file-symlink.txt'));
      expect((await getPathElement(p('test-file.txt')))!.isSymbolicLink).toBe(false);
      expect((await getPathElement(p('test-file-symlink.txt')))!.isSymbolicLink).toBe(true);
    });

    test('rejects if the target file does not exist', async () => {
      await expectToRejectCode(
        createFileSymLink(p('test-file.txt'), p('test-file-symlink.txt')),
        ERRORS.NON_EXISTENT_FILE,
      );
    });

    test('rejects if the target file is not a file', async () => {
      await createDirectory(p('some-file'));
      await expectToRejectCode(
        createFileSymLink(p('some-file'), p('some-file.txt')),
        ERRORS.NOT_A_FILE,
      );
    });
  });

  describe('writeFileAtomicIfUnchanged', () => {
    test('replaces the file when it still holds the expected bytes, keeping its mode', async () => {
      await writeTextFile(p('config.txt'), 'before');
      if (process.platform !== 'win32') {
        await chmod(p('config.txt'), 0o640);
      }

      await writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'));

      expect(await readRaw(p('config.txt'), 'utf-8')).toBe('after');
      if (process.platform !== 'win32') {
        expect((await stat(p('config.txt'))).mode & 0o777).toBe(0o640);
      }
      expect(await listTemporaryFiles(p())).toStrictEqual([]);
    });

    test('creates the file when expected is null and nothing exists', async () => {
      await writeFileAtomicIfUnchanged(p('nested/new.txt'), 'created', null);

      expect(await readRaw(p('nested/new.txt'), 'utf-8')).toBe('created');
    });

    test('creates a private file with an explicit mode', async () => {
      await writeFileAtomicIfUnchanged(p('secret.txt'), 'created', null, 0o600);

      expect(await readRaw(p('secret.txt'), 'utf-8')).toBe('created');
      if (!IS_WINDOWS) {
        expect(await permissionBits(p('secret.txt'))).toBe(0o600);
      }
      expect(await listTemporaryFiles(p())).toStrictEqual([]);
    });

    test.each([0o640, 0o644, 0o666])(
      'replaces a file with mode %i using explicit private permissions',
      async (mode) => {
        await writeTextFile(p('secret.txt'), 'before');
        if (!IS_WINDOWS) {
          await chmod(p('secret.txt'), mode);
        }

        await writeFileAtomicIfUnchanged(p('secret.txt'), 'after', Buffer.from('before'), 0o600);

        expect(await readRaw(p('secret.txt'), 'utf-8')).toBe('after');
        if (!IS_WINDOWS) {
          expect(await permissionBits(p('secret.txt'))).toBe(0o600);
        }
        expect(await listTemporaryFiles(p())).toStrictEqual([]);
      },
    );

    test.skipIf(IS_WINDOWS).each([
      ['jg-fs', 0o022],
      ['jg-fs', 0o777],
      ['jg-fs/sync', 0o022],
      ['jg-fs/sync', 0o777],
    ] as const)(
      '%s honors explicit and omitted modes under child-process umask %i',
      async (entry, umask) => {
        await mkdir(p(), { recursive: true });
        const script = `
          const { writeFileAtomicIfUnchanged } = await import(process.argv[3]);
          import { chmodSync, readFileSync, statSync, writeFileSync } from 'node:fs';
          import { join } from 'node:path';
          const directory = process.argv[1];
          const existing = join(directory, 'existing.txt');
          const created = join(directory, 'created.txt');
          const defaulted = join(directory, 'defaulted.txt');
          writeFileSync(existing, 'before');
          chmodSync(existing, 0o644);
          process.umask(Number(process.argv[2]));
          await writeFileAtomicIfUnchanged(created, 'secret', null, 0o600);
          await writeFileAtomicIfUnchanged(defaulted, '', null);
          await writeFileAtomicIfUnchanged(existing, 'after', Buffer.from('before'), 0o600);
          const modes = [created, defaulted, existing].map(path => statSync(path).mode & 0o777);
          console.log(JSON.stringify({ modes, content: readFileSync(existing, 'utf8') }));
        `;

        const { stdout } = await promisify(execFile)(
          process.execPath,
          ['--input-type=module', '-e', script, p(), String(umask), entry],
          {
            cwd: join(import.meta.dirname, '../../..'),
            signal: AbortSignal.timeout(5_000),
            maxBuffer: 65_536,
          },
        );

        expect(JSON.parse(stdout)).toStrictEqual({
          modes: [0o600, 0o666 & ~umask, 0o600],
          content: 'after',
        });
        expect(await listTemporaryFiles(p())).toStrictEqual([]);
      },
    );

    test.each([
      ['other bytes of the same length', 'BEFORE'],
      ['fewer bytes', 'befor'],
      ['more bytes', 'before and more'],
    ])('throws FILE_CHANGED, leaving the file, when it holds %s', async (_, current) => {
      await writeTextFile(p('config.txt'), current);
      if (!IS_WINDOWS) {
        await chmod(p('config.txt'), 0o644);
      }

      await expectToRejectCode(
        writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'), 0o600),
        ERRORS.FILE_CHANGED,
      );
      expect(await readRaw(p('config.txt'), 'utf-8')).toBe(current);
      if (!IS_WINDOWS) {
        expect(await permissionBits(p('config.txt'))).toBe(0o644);
      }
      expect(await listTemporaryFiles(p())).toStrictEqual([]);
    });

    test('throws FILE_CHANGED when something now exists where expected is null', async () => {
      await writeTextFile(p('new.txt'), '');

      await expectToRejectCode(
        writeFileAtomicIfUnchanged(p('new.txt'), 'created', null, 0o600),
        ERRORS.FILE_CHANGED,
      );
      expect(await readRaw(p('new.txt'), 'utf-8')).toBe('');
    });

    test('throws FILE_CHANGED when the file is gone, or the path is a directory', async () => {
      await mkdir(p('directory'), { recursive: true });

      await expectToRejectCode(
        writeFileAtomicIfUnchanged(p('missing.txt'), 'after', Buffer.from('before'), 0o600),
        ERRORS.FILE_CHANGED,
      );
      await expectToRejectCode(
        writeFileAtomicIfUnchanged(p('directory'), 'after', Buffer.from(''), 0o600),
        ERRORS.FILE_CHANGED,
      );
    });

    test.skipIf(process.platform === 'win32')(
      'throws FILE_CHANGED when the path is now a symbolic link, even to the expected bytes',
      async () => {
        await writeTextFile(p('target.txt'), 'before');
        await symlink(p('target.txt'), p('config.txt'));

        await expectToRejectCode(
          writeFileAtomicIfUnchanged(p('config.txt'), 'after', Buffer.from('before'), 0o600),
          ERRORS.FILE_CHANGED,
        );
        expect(await readRaw(p('target.txt'), 'utf-8')).toBe('before');
      },
    );
  });

  describe('writeFileAtomic', () => {
    test('creates missing parent directories and writes the content', async () => {
      await writeFileAtomic(p('nested/dir/file.txt'), 'Hello World!');
      expect(await readRaw(p('nested/dir/file.txt'), 'utf-8')).toBe('Hello World!');
      expect(await listTemporaryFiles(p('nested/dir'))).toStrictEqual([]);
    });

    test('replaces existing content and accepts bytes and empty content', async () => {
      await writeTextFile(p('file.bin'), 'old content');
      await writeFileAtomic(p('file.bin'), Buffer.from([1, 2, 3]));
      expect(await readRaw(p('file.bin'))).toStrictEqual(Buffer.from([1, 2, 3]));
      await writeFileAtomic(p('file.bin'), '');
      expect(await readRaw(p('file.bin'), 'utf-8')).toBe('');
      expect(await listTemporaryFiles(p())).toStrictEqual([]);
    });

    test('writes a destination whose name is 255 bytes long', async () => {
      const name = `${'a'.repeat(251)}.txt`;
      await writeFileAtomic(p(name), 'Hello World!');
      expect(await readRaw(p(name), 'utf-8')).toBe('Hello World!');
    });

    test.skipIf(IS_WINDOWS)('applies an explicit mode', async () => {
      await writeFileAtomic(p('secret.txt'), 'Hello World!', 0o640);
      expect(await permissionBits(p('secret.txt'))).toBe(0o640);
    });

    test.skipIf(IS_WINDOWS)('keeps the permissions of a replaced file without a mode', async () => {
      await writeTextFile(p('secret.txt'), 'old content');
      await chmod(p('secret.txt'), 0o600);
      await writeFileAtomic(p('secret.txt'), 'new content');
      expect(await permissionBits(p('secret.txt'))).toBe(0o600);
      expect(await readRaw(p('secret.txt'), 'utf-8')).toBe('new content');
    });

    test.skipIf(IS_WINDOWS)('gives a new file the same permissions as writeFile', async () => {
      await writeFile(p('plain.txt'), 'Hello World!');
      await writeFileAtomic(p('atomic.txt'), 'Hello World!');
      expect(await permissionBits(p('atomic.txt'))).toBe(await permissionBits(p('plain.txt')));
    });

    test('removes the temporary file and rejects when the rename fails', async () => {
      await createDirectory(p('target'));
      await expect(writeFileAtomic(p('target'), 'Hello World!')).rejects.toThrowError();
      expect(await isDirectory(p('target'))).toBe(true);
      expect(await listTemporaryFiles(p())).toStrictEqual([]);
    });
  });

  describe('readBoundedFile', () => {
    test('reads content of exactly maxBytes bytes', async () => {
      await writeTextFile(p('file.txt'), 'abcd');
      expect(await readBoundedFile(p('file.txt'), 4)).toStrictEqual(Buffer.from('abcd'));
    });

    test('reads an empty file', async () => {
      await writeFile(p('empty.txt'), '');
      expect(await readBoundedFile(p('empty.txt'), 4)).toStrictEqual(Buffer.alloc(0));
    });

    test('reads content larger than one read chunk', async () => {
      const content = Buffer.alloc(200_000, 7);
      await writeFile(p('large.bin'), content);
      // Buffer.equals compares the bytes exactly, without a deep equality's per-index cost
      expect((await readBoundedFile(p('large.bin'), 200_000)).equals(content)).toBe(true);
    });

    test('rejects when the content exceeds maxBytes', async () => {
      await writeTextFile(p('file.txt'), 'abcde');
      await expectToRejectCode(readBoundedFile(p('file.txt'), 4), ERRORS.FILE_TOO_LARGE);
    });

    test('rejects when the path does not exist', async () => {
      await expectToRejectCode(readBoundedFile(p('missing.txt'), 4), ERRORS.NON_EXISTENT_FILE);
    });

    test('rejects when the path is a directory', async () => {
      await createDirectory(p('some-dir'));
      await expectToRejectCode(readBoundedFile(p('some-dir'), 4), ERRORS.NOT_A_FILE);
    });

    test.skipIf(IS_WINDOWS)(
      'rejects when the final path component is a symbolic link',
      async () => {
        await writeTextFile(p('file.txt'), 'abcd');
        await createFileSymLink(p('file.txt'), p('link.txt'));
        await expectToRejectCode(
          readBoundedFile(p('link.txt'), 4),
          ERRORS.NOT_A_FILE,
          'is a symbolic link',
        );
      },
    );

    test.skipIf(IS_WINDOWS)('rejects for a named pipe without blocking', async () => {
      await createDirectory(p());
      await promisify(execFile)('mkfifo', [p('pipe')]);
      await expectToRejectCode(readBoundedFile(p('pipe'), 4), ERRORS.NOT_A_FILE);
    });

    test.skipIf(IS_WINDOWS)('follows symbolic links in parent directories', async () => {
      await writeTextFile(p('real/file.txt'), 'abcd');
      await symlink(p('real'), p('linked'), 'dir');
      expect(await readBoundedFile(p('linked/file.txt'), 4)).toStrictEqual(Buffer.from('abcd'));
    });
  });
});
