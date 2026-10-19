// @vitest-environment node
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { ERRORS } from '../../shared/index.js';

import {
  assertPrivateDirectory,
  assertPrivateFile,
  createPrivateDirectory,
  readPrivateFile,
  writePrivateFile,
} from './private-files.js';

// whether the code under test sees a platform with POSIX permission bits, which Windows lacks
const platform = vi.hoisted(() => ({ hasPosixPermissions: true }));

vi.mock('../../shared/index.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get HAS_POSIX_PERMISSIONS() {
      return platform.hasPosixPermissions;
    },
  };
});

// keeps the real filesystem, while letting a test make a call fail or report another mode
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    lstat: vi.fn(actual.lstat),
    mkdir: vi.fn(actual.mkdir),
    open: vi.fn(actual.open),
    stat: vi.fn(actual.stat),
  };
});

/**
 * Builds an error with a system error code.
 * @param code The code, such as `EACCES`.
 * @returns The error.
 */
const systemError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`${code}: simulated failure`), { code });

// a regular file's mode that the group and others can read, as a filesystem ignoring 0o600 reports
const SHARED_FILE_MODE = 0o100644;

describe('private file failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs/promises');
  });

  beforeEach(async () => {
    directory = await actualFs.realpath(await actualFs.mkdtemp(join(tmpdir(), 'jg-fs-private-')));
  });

  afterEach(async () => {
    platform.hasPosixPermissions = true;
    vi.mocked(fs.lstat).mockReset().mockImplementation(actualFs.lstat);
    vi.mocked(fs.mkdir).mockReset().mockImplementation(actualFs.mkdir);
    vi.mocked(fs.open).mockReset().mockImplementation(actualFs.open);
    vi.mocked(fs.stat).mockReset().mockImplementation(actualFs.stat);
    await actualFs.rm(directory, { recursive: true, force: true });
  });

  test('removes a file it created exclusively when the file turns out not to be private', async () => {
    const path = join(directory, 'token');
    vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
      const handle = await actualFs.open(...args);
      const stats = await handle.stat();
      vi.spyOn(handle, 'stat').mockResolvedValueOnce(
        Object.assign(stats, { mode: SHARED_FILE_MODE }),
      );
      return handle;
    });

    await expect(writePrivateFile(path, 'secret', { isExclusive: true })).rejects.toMatchObject({
      code: ERRORS.FILE_NOT_PRIVATE,
      data: { path, mode: '0644' },
    });
    await expect(actualFs.lstat(path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('throws when a file it replaced turns out not to be private', async () => {
    const path = join(directory, 'token');
    vi.mocked(fs.stat).mockImplementation(async (target, ...rest) => {
      const stats = await actualFs.stat(target, ...rest);
      return target === path ? Object.assign(stats, { mode: SHARED_FILE_MODE }) : stats;
    });

    await expect(writePrivateFile(path, 'secret')).rejects.toMatchObject({
      code: ERRORS.FILE_NOT_PRIVATE,
    });
  });

  test('passes on an error other than an existing path from an exclusive create', async () => {
    vi.mocked(fs.open).mockRejectedValueOnce(systemError('EACCES'));

    await expect(
      writePrivateFile(join(directory, 'token'), 'secret', { isExclusive: true }),
    ).rejects.toMatchObject({ code: 'EACCES' });
  });

  test('passes on an error other than a file in the way from creating a directory', async () => {
    vi.mocked(fs.mkdir).mockRejectedValueOnce(systemError('EACCES'));

    await expect(createPrivateDirectory(join(directory, 'config'))).rejects.toMatchObject({
      code: 'EACCES',
    });
  });

  test('passes on an error other than a missing path from checking a directory', async () => {
    const path = join(directory, 'token');
    await actualFs.writeFile(path, 'secret', { mode: 0o600 });
    vi.mocked(fs.stat).mockRejectedValueOnce(systemError('EACCES'));
    vi.mocked(fs.lstat).mockRejectedValueOnce(systemError('EACCES'));

    await expect(assertPrivateFile(path, { rootPath: directory })).rejects.toMatchObject({
      code: 'EACCES',
    });
    await expect(assertPrivateDirectory(directory)).rejects.toMatchObject({ code: 'EACCES' });
  });

  test('skips only the permission checks where the platform has no POSIX permissions', async () => {
    platform.hasPosixPermissions = false;
    const path = join(directory, 'token');
    await actualFs.writeFile(path, 'secret', { mode: 0o644 });
    await actualFs.chmod(path, 0o644);
    const sharedDirectory = join(directory, 'shared');
    await actualFs.mkdir(sharedDirectory);
    await actualFs.chmod(sharedDirectory, 0o755);
    await actualFs.symlink(path, join(directory, 'link'));

    await expect(assertPrivateFile(path)).resolves.toBeUndefined();
    expect((await readPrivateFile(path, { maxBytes: 64 })).toString('utf8')).toBe('secret');
    await expect(writePrivateFile(path, 'replaced')).resolves.toBeUndefined();
    await expect(
      writePrivateFile(join(directory, 'new'), 'created', { isExclusive: true }),
    ).resolves.toBeUndefined();
    await expect(assertPrivateDirectory(sharedDirectory)).resolves.toBeUndefined();
    await expect(createPrivateDirectory(sharedDirectory)).resolves.toBeUndefined();
    await expect(assertPrivateFile(join(directory, 'link'))).rejects.toMatchObject({
      code: ERRORS.NOT_A_FILE,
    });
  });
});
