import { Buffer } from 'node:buffer';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

// permission tests need a user the permission bits apply to, which root isn't
const CAN_TEST_PERMISSIONS = process.platform !== 'win32' && process.getuid?.() !== 0;

import * as asyncApi from './index.js';
import * as syncApi from './sync/index.js';

// the async API's shape, which the sync API matches once its functions are wrapped in promises
type IFsApi = typeof asyncApi;

/*
 * The sync entry with every function wrapped so it returns a promise, so one table of cases runs
 * against both entries, and a sync throw becomes a rejection the same assertions can check.
 */
const promisifiedSyncApi = Object.fromEntries(
  Object.entries(syncApi).map(([name, member]) => [
    name,
    typeof member === 'function'
      ? (...args: unknown[]) =>
          Promise.resolve().then(() => (member as (...a: unknown[]) => unknown)(...args))
      : member,
  ]),
) as unknown as IFsApi;

describe.each([
  ['jg-fs', asyncApi],
  ['jg-fs/sync', promisifiedSyncApi],
])('%s', (_entry, fs) => {
  let root: string;

  // builds a path inside the test's own temporary directory
  const p = (...segments: string[]): string => join(root, ...segments);

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'jg-fs-parity-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test('writes and reads text, JSON, and binary files, including empty ones', async () => {
    await fs.writeTextFile(p('nested', 'a.txt'), 'hello');
    await fs.writeTextFile(p('empty.txt'), '');
    await fs.writeJSONFile(p('data.json'), { id: 1, tags: ['a'] });
    await fs.writeBufferFile(p('data.bin'), Buffer.from([0, 1, 2]));
    await fs.writeBufferFile(p('empty.bin'), Buffer.alloc(0));

    expect(await fs.readTextFile(p('nested', 'a.txt'))).toBe('hello');
    expect(await fs.readTextFile(p('empty.txt'))).toBe('');
    expect(await fs.readJSONFile(p('data.json'))).toStrictEqual({ id: 1, tags: ['a'] });
    expect(await fs.readBufferFile(p('data.bin'))).toStrictEqual(Buffer.from([0, 1, 2]));
    expect(await fs.readBufferFile(p('empty.bin'))).toStrictEqual(Buffer.alloc(0));
  });

  test('rejects empty JSON, unparsable JSON, and data of the wrong type', async () => {
    await fs.writeTextFile(p('empty.json'), '');
    await fs.writeTextFile(p('broken.json'), '{ nope');

    await expectToRejectCode(
      fs.writeJSONFile(p('x.json'), ''),
      fs.ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
    await expectToRejectCode(
      fs.writeJSONFile(p('x.json'), undefined),
      fs.ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
    await expectToRejectCode(
      fs.readJSONFile(p('empty.json')),
      fs.ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
    await expectToRejectCode(
      fs.readJSONFile(p('broken.json')),
      fs.ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
    await expectToRejectCode(
      fs.writeBufferFile(p('x.bin'), 'text' as never),
      fs.ERRORS.FILE_CONTENT_IS_EMPTY_OR_INVALID,
    );
  });

  test('creates directories idempotently, and rejects a file in the way', async () => {
    await fs.writeTextFile(p('dir', 'kept.txt'), 'kept');
    await fs.createDirectory(p('dir'));
    expect(await fs.readTextFile(p('dir', 'kept.txt'))).toBe('kept');

    await fs.createDirectory(p('dir'), true);
    expect(await fs.readDirectory(p('dir'))).toStrictEqual([]);

    await fs.writeTextFile(p('file'), 'x');
    await expectToRejectCode(fs.createDirectory(p('file')), fs.ERRORS.DIRECTORY_ALREADY_EXISTS);
  });

  test('lists directory contents joined to the directory path, recursively when asked', async () => {
    await fs.writeTextFile(p('dir', 'a.txt'), 'a');
    await fs.writeTextFile(p('dir', 'sub', 'b.txt'), 'b');

    expect((await fs.readDirectory(p('dir'))).sort()).toStrictEqual([
      p('dir', 'a.txt'),
      p('dir', 'sub'),
    ]);
    expect((await fs.readDirectory(p('dir'), true)).sort()).toStrictEqual([
      p('dir', 'a.txt'),
      p('dir', 'sub'),
      p('dir', 'sub', 'b.txt'),
    ]);
  });

  test('groups and sorts directory elements, matching extensions case-insensitively', async () => {
    await fs.writeTextFile(p('dir', 'b.JSON'), '{}');
    await fs.writeTextFile(p('dir', 'a.json'), '{}');
    await fs.writeTextFile(p('dir', 'c.txt'), 'c');
    await fs.createDirectory(p('dir', 'sub'));

    const elements = await fs.getDirectoryElements(p('dir'), {
      includeExts: ['.Json'],
      sortOrder: 'desc',
    });

    expect(elements.files.map(({ baseName }) => baseName)).toStrictEqual(['b.JSON', 'a.json']);
    expect(elements.directories.map(({ baseName }) => baseName)).toStrictEqual(['sub']);
    expect(elements.symbolicLinks).toStrictEqual([]);
  });

  test('reads bounded files and rejects larger ones', async () => {
    await fs.writeTextFile(p('small.txt'), '12345');

    expect((await fs.readBoundedFile(p('small.txt'), 5)).toString()).toBe('12345');
    await expectToRejectCode(fs.readBoundedFile(p('small.txt'), 4), fs.ERRORS.FILE_TOO_LARGE);
    await expectToRejectCode(fs.readBoundedFile(p('missing.txt'), 4), fs.ERRORS.NOT_A_FILE);
  });

  test('reports the same codes for missing and mismatched paths', async () => {
    await fs.createDirectory(p('dir'));

    await expectToRejectCode(fs.readTextFile(p('missing.txt')), fs.ERRORS.NOT_A_FILE);
    await expectToRejectCode(fs.readTextFile(p('dir')), fs.ERRORS.NOT_A_FILE);
    await expectToRejectCode(fs.readDirectory(p('missing')), fs.ERRORS.NOT_A_DIRECTORY);
    await expectToRejectCode(fs.copyDirectory(p('missing'), p('copy')), fs.ERRORS.NOT_A_DIRECTORY);
    await expectToRejectCode(
      fs.createDirectorySymLink(p('missing'), p('link')),
      fs.ERRORS.NON_EXISTENT_DIRECTORY,
    );
    await expectToRejectCode(
      fs.createFileSymLink(p('missing.txt'), p('link')),
      fs.ERRORS.NON_EXISTENT_FILE,
    );
    await expectToRejectCode(fs.deleteFile(p('dir')), fs.ERRORS.NOT_A_FILE);
  });

  test('writes files atomically, keeping no temporary file', async () => {
    await fs.writeFileAtomic(p('dir', 'state.json'), '{"v":1}');
    await fs.writeFileAtomic(p('dir', 'state.json'), '{"v":2}');

    expect(await fs.readTextFile(p('dir', 'state.json'))).toBe('{"v":2}');
    expect(await fs.readDirectory(p('dir'))).toStrictEqual([p('dir', 'state.json')]);
  });

  test.runIf(process.platform === 'linux')(
    'rejects a file that holds more than its size said, as FILE_TOO_LARGE, without reading it all',
    async () => {
      // /proc files report a size of 0, so only reading finds their content
      await expectToRejectCode(
        fs.readBoundedFile('/proc/self/status', 10),
        asyncApi.ERRORS.FILE_TOO_LARGE,
      );
    },
  );

  test.runIf(CAN_TEST_PERMISSIONS)(
    'lets a permission error through unchanged, from a read or an atomic write',
    async () => {
      await writeFile(p('locked.txt'), 'secret');
      await chmod(p('locked.txt'), 0o000);
      await mkdir(p('unsearchable'));
      await chmod(p('unsearchable'), 0o600);
      try {
        await expect(fs.readBoundedFile(p('locked.txt'), 100)).rejects.toMatchObject({
          code: 'EACCES',
        });
        await expect(
          fs.writeFileAtomic(p('unsearchable', 'state.json'), '{}'),
        ).rejects.toMatchObject({ code: 'EACCES' });
      } finally {
        await chmod(p('unsearchable'), 0o700);
      }
    },
  );
});
