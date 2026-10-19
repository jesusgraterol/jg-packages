// @vitest-environment node
import { Buffer } from 'node:buffer';
import { realpathSync } from 'node:fs';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile as readRaw,
  rm,
  stat,
  symlink,
  writeFile as writeRaw,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../../shared/index.js';
import * as syncPrivateFiles from '../../sync/private-files/index.js';

import * as asyncPrivateFiles from './index.js';

// POSIX permission bits, which Windows doesn't report
const IS_WINDOWS = process.platform === 'win32';

// the async functions' shape, which the sync ones match once wrapped in promises
type IPrivateFilesApi = typeof asyncPrivateFiles;

/*
 * The sync functions wrapped so they return promises, so every case runs against both entries, and
 * a sync throw becomes a rejection the same assertions can check.
 */
const promisifiedSyncPrivateFiles = Object.fromEntries(
  Object.entries(syncPrivateFiles).map(([name, member]) => [
    name,
    (...args: unknown[]) =>
      Promise.resolve().then(() => (member as (...a: unknown[]) => unknown)(...args)),
  ]),
) as unknown as IPrivateFilesApi;

const ENTRIES = [
  ['async', asyncPrivateFiles],
  ['sync', promisifiedSyncPrivateFiles],
] as const;

describe.each(ENTRIES)('private files, %s', (_, api) => {
  let directory: string;

  // the permission bits of a path
  const modeOf = async (path: string): Promise<number> => (await stat(path)).mode & 0o777;

  // writes a file with the given permission bits, and returns its path
  const writeFixture = async (name: string, contents: string, mode: number): Promise<string> => {
    const path = join(directory, name);
    await writeRaw(path, contents);
    await chmod(path, mode);
    return path;
  };

  beforeEach(async () => {
    // macOS keeps the temporary directory behind a symbolic link, so the fixtures use the real path
    directory = realpathSync(await mkdtemp(join(tmpdir(), 'jg-fs-private-')));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('assertPrivateFile and readPrivateFile', () => {
    test('accept and read a file only its owner can access', async () => {
      const path = await writeFixture('token.json', '{"token":"abc"}', 0o600);

      await expect(api.assertPrivateFile(path)).resolves.toBeUndefined();
      expect((await api.readPrivateFile(path, { maxBytes: 64 })).toString('utf8')).toBe(
        '{"token":"abc"}',
      );
    });

    test.skipIf(IS_WINDOWS)(
      'refuse a file the group or others can access, naming its mode',
      async () => {
        const path = await writeFixture('token.json', 'secret', 0o644);

        await expect(api.assertPrivateFile(path)).rejects.toMatchObject({
          code: ERRORS.FILE_NOT_PRIVATE,
          message: `The file '${path}' can be accessed by other users.`,
          data: { path, mode: '0644' },
        });
        await chmod(path, 0o640);
        await expectToRejectCode(
          api.readPrivateFile(path, { maxBytes: 64 }),
          ERRORS.FILE_NOT_PRIVATE,
        );
      },
    );

    test('refuse a missing file as non-existent', async () => {
      const path = join(directory, 'missing');

      await expect(api.assertPrivateFile(path)).rejects.toMatchObject({
        code: ERRORS.NON_EXISTENT_FILE,
        message: `The file '${path}' does not exist.`,
        data: { path },
      });
      await expectToRejectCode(
        api.readPrivateFile(join(directory, 'missing-parent', 'token'), { maxBytes: 64 }),
        ERRORS.NON_EXISTENT_FILE,
      );
    });

    test('refuse a path through a file as non-existent, and a root or directory under one', async () => {
      const file = await writeFixture('file', '', 0o600);

      await expectToRejectCode(
        api.assertPrivateFile(join(file, 'token')),
        ERRORS.NON_EXISTENT_FILE,
      );
      await expectToRejectCode(
        api.assertPrivateFile(join(file, 'root', 'token'), { rootPath: join(file, 'root') }),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.writePrivateFile(join(file, 'token'), 'x'),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.assertPrivateDirectory(join(file, 'child')),
        ERRORS.NOT_A_DIRECTORY,
      );
    });

    test('refuse a symbolic link, a dangling one, and a directory as not a file', async () => {
      const target = await writeFixture('target', 'secret', 0o600);
      await symlink(target, join(directory, 'link'));
      await symlink(join(directory, 'nowhere'), join(directory, 'dangling'));
      await mkdir(join(directory, 'folder'), { mode: 0o700 });

      for (const name of ['link', 'dangling', 'folder']) {
        await expectToRejectCode(api.assertPrivateFile(join(directory, name)), ERRORS.NOT_A_FILE);
      }
    });

    test('refuse a path that goes through a symbolic link', async () => {
      await mkdir(join(directory, 'real'), { mode: 0o700 });
      await writeFixture('real/token', 'secret', 0o600);
      await symlink(join(directory, 'real'), join(directory, 'alias'));

      await expectToRejectCode(
        api.assertPrivateFile(join(directory, 'alias', 'token')),
        ERRORS.PATH_NOT_CANONICAL,
        'goes through a symbolic link',
      );
    });

    test('refuse a file larger than maxBytes', async () => {
      const path = await writeFixture('big', 'x'.repeat(65), 0o600);

      await expectToRejectCode(
        api.assertPrivateFile(path, { maxBytes: 64 }),
        ERRORS.FILE_TOO_LARGE,
      );
      await expectToRejectCode(api.readPrivateFile(path, { maxBytes: 64 }), ERRORS.FILE_TOO_LARGE);
    });

    test('accept a file strictly inside its root, and refuse one outside it', async () => {
      await mkdir(join(directory, 'root'), { mode: 0o700 });
      const inside = await writeFixture('root/token', 'secret', 0o600);
      const outside = await writeFixture('token', 'secret', 0o600);
      const rootPath = join(directory, 'root');

      await expect(api.assertPrivateFile(inside, { rootPath })).resolves.toBeUndefined();
      await expect(api.assertPrivateFile(outside, { rootPath })).rejects.toMatchObject({
        code: ERRORS.PATH_OUTSIDE_ROOT,
        data: { path: outside, rootPath },
      });
      await expectToRejectCode(
        api.assertPrivateFile(join(rootPath, '..', 'token'), { rootPath }),
        ERRORS.PATH_OUTSIDE_ROOT,
      );
    });

    test('refuse a root that is missing, a file, or a symbolic link', async () => {
      const token = await writeFixture('token', 'secret', 0o600);
      await symlink(directory, join(directory, 'linked-root'));

      await expectToRejectCode(
        api.assertPrivateFile(token, { rootPath: join(directory, 'missing') }),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.assertPrivateFile(token, { rootPath: token }),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.assertPrivateFile(join(directory, 'linked-root', 'token'), {
          rootPath: join(directory, 'linked-root'),
        }),
        ERRORS.PATH_NOT_CANONICAL,
      );
    });
  });

  describe('writePrivateFile', () => {
    test.skipIf(IS_WINDOWS)(
      'creates a file only its owner can access, and replaces it the same way',
      async () => {
        const path = join(directory, 'session.json');

        await api.writePrivateFile(path, '{"id":1}');
        expect(await modeOf(path)).toBe(0o600);
        await api.writePrivateFile(path, Buffer.from('{"id":2}'));

        expect(await readRaw(path, 'utf8')).toBe('{"id":2}');
        expect(await modeOf(path)).toBe(0o600);
      },
    );

    test.skipIf(IS_WINDOWS)('never overwrites a file others can access', async () => {
      const path = await writeFixture('shared', 'original', 0o644);

      await expectToRejectCode(api.writePrivateFile(path, 'new'), ERRORS.FILE_NOT_PRIVATE);
      expect(await readRaw(path, 'utf8')).toBe('original');
    });

    test('never writes through a symbolic link at the path', async () => {
      const target = await writeFixture('target', 'original', 0o600);
      const link = join(directory, 'link');
      await symlink(target, link);

      await expectToRejectCode(api.writePrivateFile(link, 'new'), ERRORS.NOT_A_FILE);
      expect(await readRaw(target, 'utf8')).toBe('original');
    });

    test('refuses a directory that is missing or goes through a symbolic link', async () => {
      await mkdir(join(directory, 'real'), { mode: 0o700 });
      await symlink(join(directory, 'real'), join(directory, 'alias'));

      await expectToRejectCode(
        api.writePrivateFile(join(directory, 'missing', 'token'), 'x'),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.writePrivateFile(join(directory, 'alias', 'token'), 'x'),
        ERRORS.PATH_NOT_CANONICAL,
      );
    });

    test('refuses a file outside its root', async () => {
      await mkdir(join(directory, 'root'), { mode: 0o700 });

      await expectToRejectCode(
        api.writePrivateFile(join(directory, 'token'), 'x', { rootPath: join(directory, 'root') }),
        ERRORS.PATH_OUTSIDE_ROOT,
      );
    });

    test.skipIf(IS_WINDOWS)('creates a file exclusively, with 0600 permissions', async () => {
      const path = join(directory, 'lock');

      await api.writePrivateFile(path, 'owner', { isExclusive: true });

      expect(await readRaw(path, 'utf8')).toBe('owner');
      expect(await modeOf(path)).toBe(0o600);
    });

    test('creates no file exclusively over anything already at the path', async () => {
      const path = await writeFixture('lock', 'original', 0o600);
      const dangling = join(directory, 'dangling');
      await symlink(join(directory, 'nowhere'), dangling);

      await expect(api.writePrivateFile(path, 'new', { isExclusive: true })).rejects.toMatchObject({
        code: ERRORS.FILE_ALREADY_EXISTS,
        message: `The file '${path}' already exists.`,
      });
      await expectToRejectCode(
        api.writePrivateFile(dangling, 'new', { isExclusive: true }),
        ERRORS.FILE_ALREADY_EXISTS,
      );
      expect(await readRaw(path, 'utf8')).toBe('original');
    });

    test('removes a file it created exclusively when writing fails', async () => {
      const path = join(directory, 'partial');

      await expect(
        api.writePrivateFile(path, 42 as unknown as string, { isExclusive: true }),
      ).rejects.toThrow();

      await expect(stat(path)).rejects.toMatchObject({ code: 'ENOENT' });
    });
  });

  describe('assertPrivateDirectory and createPrivateDirectory', () => {
    test.skipIf(IS_WINDOWS)('create nested directories only their owner can access', async () => {
      const path = join(directory, 'config', 'sessions');

      await api.createPrivateDirectory(path);

      expect(await modeOf(path)).toBe(0o700);
      await expect(api.assertPrivateDirectory(path)).resolves.toBeUndefined();
      await expect(api.createPrivateDirectory(path)).resolves.toBeUndefined();
    });

    test.skipIf(IS_WINDOWS)(
      'refuse a directory others can access, without changing it',
      async () => {
        const path = join(directory, 'shared');
        await mkdir(path);
        await chmod(path, 0o755);

        await expect(api.assertPrivateDirectory(path)).rejects.toMatchObject({
          code: ERRORS.DIRECTORY_NOT_PRIVATE,
          message: `The directory '${path}' can be accessed by other users.`,
          data: { path, mode: '0755' },
        });
        await expectToRejectCode(api.createPrivateDirectory(path), ERRORS.DIRECTORY_NOT_PRIVATE);
        expect(await modeOf(path)).toBe(0o755);
      },
    );

    test('refuse a missing path, a file, a symbolic link, and a path through one', async () => {
      const file = await writeFixture('file', '', 0o600);
      await mkdir(join(directory, 'real'), { mode: 0o700 });
      await mkdir(join(directory, 'real', 'inner'), { mode: 0o700 });
      await symlink(join(directory, 'real'), join(directory, 'alias'));

      await expectToRejectCode(
        api.assertPrivateDirectory(join(directory, 'missing')),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(api.assertPrivateDirectory(file), ERRORS.NOT_A_DIRECTORY);
      await expectToRejectCode(
        api.assertPrivateDirectory(join(directory, 'alias')),
        ERRORS.NOT_A_DIRECTORY,
      );
      await expectToRejectCode(
        api.assertPrivateDirectory(join(directory, 'alias', 'inner')),
        ERRORS.PATH_NOT_CANONICAL,
      );
      await expectToRejectCode(api.createPrivateDirectory(file), ERRORS.NOT_A_DIRECTORY);
      await expectToRejectCode(
        api.createPrivateDirectory(join(file, 'child')),
        ERRORS.NOT_A_DIRECTORY,
      );
    });
  });
});
