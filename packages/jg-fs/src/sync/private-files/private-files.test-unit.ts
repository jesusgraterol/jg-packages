// @vitest-environment node
import * as fs from 'node:fs';
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
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    fstatSync: vi.fn(actual.fstatSync),
    lstatSync: vi.fn(actual.lstatSync),
    mkdirSync: vi.fn(actual.mkdirSync),
    openSync: vi.fn(actual.openSync),
    statSync: vi.fn(actual.statSync),
  };
});

/**
 * Builds an error with a system error code.
 * @param code The code, such as `EACCES`.
 * @returns The error.
 */
const systemError = (code: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`${code}: simulated failure`), { code });

/**
 * Runs a function that must throw, and gives what it threw.
 * @param run The function.
 * @returns The thrown value.
 */
const catchError = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('The function did not throw.');
};

// a regular file's mode that the group and others can read, as a filesystem ignoring 0o600 reports
const SHARED_FILE_MODE = 0o100644;

describe('private file failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs');
  });

  beforeEach(() => {
    directory = actualFs.realpathSync(actualFs.mkdtempSync(join(tmpdir(), 'jg-fs-private-')));
  });

  afterEach(() => {
    platform.hasPosixPermissions = true;
    vi.mocked(fs.fstatSync).mockReset().mockImplementation(actualFs.fstatSync);
    vi.mocked(fs.lstatSync).mockReset().mockImplementation(actualFs.lstatSync);
    vi.mocked(fs.mkdirSync).mockReset().mockImplementation(actualFs.mkdirSync);
    vi.mocked(fs.openSync).mockReset().mockImplementation(actualFs.openSync);
    vi.mocked(fs.statSync).mockReset().mockImplementation(actualFs.statSync);
    actualFs.rmSync(directory, { recursive: true, force: true });
  });

  test('removes a file it created exclusively when the file turns out not to be private', () => {
    const path = join(directory, 'token');
    vi.mocked(fs.fstatSync).mockImplementationOnce((descriptor: number) =>
      Object.assign(actualFs.fstatSync(descriptor), { mode: SHARED_FILE_MODE }),
    );

    expect(catchError(() => writePrivateFile(path, 'secret', { isExclusive: true }))).toMatchObject(
      { code: ERRORS.FILE_NOT_PRIVATE, data: { path, mode: '0644' } },
    );
    expect(actualFs.existsSync(path)).toBe(false);
  });

  test('throws when a file it replaced turns out not to be private', () => {
    const path = join(directory, 'token');
    vi.mocked(fs.statSync).mockImplementation((target: fs.PathLike) => {
      const stats = actualFs.statSync(target);
      return target === path ? Object.assign(stats, { mode: SHARED_FILE_MODE }) : stats;
    });

    expect(catchError(() => writePrivateFile(path, 'secret'))).toMatchObject({
      code: ERRORS.FILE_NOT_PRIVATE,
    });
  });

  test('passes on an error other than an existing path from an exclusive create', () => {
    vi.mocked(fs.openSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });

    expect(
      catchError(() => writePrivateFile(join(directory, 'token'), 'secret', { isExclusive: true })),
    ).toMatchObject({ code: 'EACCES' });
  });

  test('passes on an error other than a file in the way from creating a directory', () => {
    vi.mocked(fs.mkdirSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });

    expect(catchError(() => createPrivateDirectory(join(directory, 'config')))).toMatchObject({
      code: 'EACCES',
    });
  });

  test('passes on an error other than a missing path from checking a directory', () => {
    const path = join(directory, 'token');
    actualFs.writeFileSync(path, 'secret', { mode: 0o600 });
    vi.mocked(fs.statSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });
    vi.mocked(fs.lstatSync).mockImplementationOnce(() => {
      throw systemError('EACCES');
    });

    expect(catchError(() => assertPrivateFile(path, { rootPath: directory }))).toMatchObject({
      code: 'EACCES',
    });
    expect(catchError(() => assertPrivateDirectory(directory))).toMatchObject({ code: 'EACCES' });
  });

  test('skips only the permission checks where the platform has no POSIX permissions', () => {
    platform.hasPosixPermissions = false;
    const path = join(directory, 'token');
    actualFs.writeFileSync(path, 'secret');
    actualFs.chmodSync(path, 0o644);
    const sharedDirectory = join(directory, 'shared');
    actualFs.mkdirSync(sharedDirectory);
    actualFs.chmodSync(sharedDirectory, 0o755);
    actualFs.symlinkSync(path, join(directory, 'link'));

    expect(assertPrivateFile(path)).toBeUndefined();
    expect(readPrivateFile(path, { maxBytes: 64 }).toString('utf8')).toBe('secret');
    expect(writePrivateFile(path, 'replaced')).toBeUndefined();
    expect(
      writePrivateFile(join(directory, 'new'), 'created', { isExclusive: true }),
    ).toBeUndefined();
    expect(assertPrivateDirectory(sharedDirectory)).toBeUndefined();
    expect(createPrivateDirectory(sharedDirectory)).toBeUndefined();
    expect(catchError(() => assertPrivateFile(join(directory, 'link')))).toMatchObject({
      code: ERRORS.NOT_A_FILE,
    });
  });
});
