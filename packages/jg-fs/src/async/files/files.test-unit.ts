// @vitest-environment node
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { writeFileAtomic } from './files.js';

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
    directory = await fs.mkdtemp(join(tmpdir(), 'fs-utils-async-'));
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
