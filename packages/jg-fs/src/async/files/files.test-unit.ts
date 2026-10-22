// @vitest-environment node
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { writeFileAtomic, writeFileAtomicIfUnchanged } from './files.js';

// keeps the real filesystem, while letting a test make a single file handle fail
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, open: vi.fn(actual.open) };
});

describe('writeFileAtomic failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  // lists the temporary files writeFileAtomic left behind
  const listTemporaryFiles = async (): Promise<string[]> =>
    (await fs.readdir(directory)).filter((name) => name.endsWith('.tmp'));

  // opens a real file handle whose given method fails
  const openFailing =
    (method: 'writeFile' | 'sync', error: Error) =>
    async (...args: Parameters<typeof fs.open>): Promise<fs.FileHandle> => {
      const handle = await actualFs.open(...args);
      handle[method] = () => Promise.reject(error);
      return handle;
    };

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs/promises');
    directory = await fs.mkdtemp(join(tmpdir(), 'jg-fs-'));
  });

  afterEach(() => {
    vi.mocked(fs.open).mockReset().mockImplementation(actualFs.open);
  });

  afterAll(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  test('leaves the destination untouched and removes the temporary file when writing fails', async () => {
    const destination = join(directory, 'write-failure.txt');
    await fs.writeFile(destination, 'old content');
    vi.mocked(fs.open).mockImplementationOnce(
      openFailing('writeFile', new Error('ENOSPC: no space left on device')),
    );

    await expect(writeFileAtomic(destination, 'new content')).rejects.toThrowError('ENOSPC');
    expect(await fs.readFile(destination, 'utf-8')).toBe('old content');
    expect(await listTemporaryFiles()).toStrictEqual([]);
  });

  test.skipIf(process.platform === 'win32')(
    'rejects after the rename when flushing the directory fails',
    async () => {
      const destination = join(directory, 'directory-sync-failure.txt');
      await fs.writeFile(destination, 'old content');
      vi.mocked(fs.open)
        .mockImplementationOnce((...args) => actualFs.open(...args))
        .mockImplementationOnce(openFailing('sync', new Error('EIO: i/o error, fsync')));

      await expect(writeFileAtomic(destination, 'new content')).rejects.toThrowError('EIO');
      expect(await fs.readFile(destination, 'utf-8')).toBe('new content');
      expect(await listTemporaryFiles()).toStrictEqual([]);
    },
  );
});

describe('writeFileAtomicIfUnchanged failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs/promises');
    directory = await fs.mkdtemp(join(tmpdir(), 'jg-fs-'));
  });

  afterEach(() => {
    vi.mocked(fs.open).mockReset().mockImplementation(actualFs.open);
  });

  afterAll(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  test.skipIf(process.platform === 'win32')(
    'sets private permissions before writing any content to the temporary file',
    async () => {
      const destination = join(directory, 'private.txt');
      await fs.writeFile(destination, 'before', { mode: 0o644 });
      let modeAtWrite: number | undefined;
      vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
        const handle = await actualFs.open(...args);
        const write = handle.writeFile.bind(handle);
        handle.writeFile = async (...writeArgs) => {
          modeAtWrite = (await handle.stat()).mode & 0o777;
          return write(...writeArgs);
        };
        return handle;
      });

      await writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600);

      expect(modeAtWrite).toBe(0o600);
      expect(await fs.readFile(destination, 'utf8')).toBe('after');
    },
  );

  test('leaves the destination untouched and removes the temporary file when setting its mode fails', async () => {
    const destination = join(directory, 'mode-failure.txt');
    await fs.writeFile(destination, 'before');
    const modeBefore = (await fs.stat(destination)).mode;
    const denied = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    vi.mocked(fs.open).mockImplementationOnce(async (...args) => {
      const handle = await actualFs.open(...args);
      handle.chmod = () => Promise.reject(denied);
      return handle;
    });

    await expect(
      writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600),
    ).rejects.toBe(denied);

    expect(await fs.readFile(destination, 'utf8')).toBe('before');
    expect((await fs.stat(destination)).mode).toBe(modeBefore);
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.tmp'))).toStrictEqual([]);
  });

  test('passes on an error reading the file back, other than a change, leaving it untouched', async () => {
    const destination = join(directory, 'config.txt');
    await fs.writeFile(destination, 'before');
    const modeBefore = (await fs.stat(destination)).mode;
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    // the read-back opens the destination itself with numeric flags; the temporary file uses 'wx'
    vi.mocked(fs.open).mockImplementation(async (path, flags, mode) => {
      if (String(path) === destination && typeof flags === 'number') {
        throw denied;
      }
      return actualFs.open(path, flags, mode);
    });

    await expect(
      writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600),
    ).rejects.toBe(denied);
    expect(await fs.readFile(destination, 'utf8')).toBe('before');
    expect((await fs.stat(destination)).mode).toBe(modeBefore);
    expect((await fs.readdir(directory)).filter((name) => name.endsWith('.tmp'))).toStrictEqual([]);
  });
});
