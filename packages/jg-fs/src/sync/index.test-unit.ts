import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './index.js';

// keeps the real filesystem, while letting a test make a single call fail
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
    fsyncSync: vi.fn(actual.fsyncSync),
  };
});

/* ************************************************************************************************
 *                                         WRITE FAILURES                                         *
 ************************************************************************************************ */
describe('writeFileAtomic failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  // lists the temporary files writeFileAtomic left behind
  const listTemporaryFiles = (): string[] =>
    fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'));

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs');
    directory = fs.mkdtempSync(join(tmpdir(), 'jg-fs-sync-'));
  });

  afterEach(() => {
    vi.mocked(fs.writeFileSync).mockReset().mockImplementation(actualFs.writeFileSync);
    vi.mocked(fs.fsyncSync).mockReset().mockImplementation(actualFs.fsyncSync);
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('leaves the destination untouched and removes the temporary file when writing fails', () => {
    const destination = join(directory, 'write-failure.txt');
    fs.writeFileSync(destination, 'old content');
    vi.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('ENOSPC: no space left on device');
    });

    expect(() => writeFileAtomic(destination, 'new content')).toThrowError('ENOSPC');
    expect(fs.readFileSync(destination, 'utf-8')).toBe('old content');
    expect(listTemporaryFiles()).toStrictEqual([]);
  });

  test.skipIf(process.platform === 'win32')(
    'throws after the rename when flushing the directory fails',
    () => {
      const destination = join(directory, 'directory-sync-failure.txt');
      fs.writeFileSync(destination, 'old content');
      vi.mocked(fs.fsyncSync)
        .mockImplementationOnce((fd) => actualFs.fsyncSync(fd))
        .mockImplementationOnce(() => {
          throw new Error('EIO: i/o error, fsync');
        });

      expect(() => writeFileAtomic(destination, 'new content')).toThrowError('EIO');
      expect(fs.readFileSync(destination, 'utf-8')).toBe('new content');
      expect(listTemporaryFiles()).toStrictEqual([]);
    },
  );
});
