import { Buffer } from 'node:buffer';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ERRORS, hashFile } from '../../index.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, lstat: vi.fn(actual.lstat), open: vi.fn(actual.open) };
});

const actual = await vi.importActual<typeof fs>('node:fs/promises');
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'jg-fs-hash-'));
});

afterEach(async () => {
  vi.mocked(fs.open).mockReset().mockImplementation(actual.open);
  vi.mocked(fs.lstat).mockReset().mockImplementation(actual.lstat);
  await fs.rm(root, { recursive: true, force: true });
});

test('returns fixed digests at the empty and multichunk byte limits', async () => {
  const empty = join(root, 'empty.bin');
  await fs.writeFile(empty, '');
  await expect(hashFile(empty, { maxBytes: 0 })).resolves.toStrictEqual({
    size: 0,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  });

  const bytes = Buffer.alloc(131_073, 97);
  const path = join(root, 'input.bin');
  await fs.writeFile(path, bytes);
  await expect(hashFile(path, { maxBytes: bytes.length })).resolves.toStrictEqual({
    size: 131_073,
    sha256: '7e009ea4ef882e385b3c0bcbbfa8d009bb0a633bdd764415c09182ee0e75da73',
  });
  await expectToRejectCode(hashFile(path, { maxBytes: bytes.length - 1 }), ERRORS.FILE_TOO_LARGE);
});

test.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
  'refuses an invalid size limit %s before opening the path',
  async (maxBytes) => {
    await expectToRejectCode(
      hashFile(join(root, 'missing.bin'), { maxBytes }),
      ERRORS.INVALID_FILE_SIZE_LIMIT,
      'The file size limit must be a non-negative safe integer.',
    );
  },
);

test('rejects missing paths and directories', async () => {
  await expectToRejectCode(hashFile(join(root, 'missing.bin')), ERRORS.NON_EXISTENT_FILE);
  await expectToRejectCode(hashFile(root), ERRORS.NOT_A_FILE);
});

test.skipIf(process.platform === 'win32')(
  'rejects a link in the final path component',
  async () => {
    const path = join(root, 'linked.bin');
    const target = join(root, 'target.bin');
    await fs.writeFile(target, 'abc');
    await fs.symlink(target, path);
    await expectToRejectCode(hashFile(path), ERRORS.NOT_A_FILE);
  },
);

test('identity swap after open is refused before any descriptor read', async () => {
  const path = join(root, 'input.bin');
  await fs.writeFile(path, 'abc');
  const handle = await actual.open(path, 'r');
  const read = vi.spyOn(handle, 'read');
  vi.mocked(fs.open).mockImplementationOnce(async () => {
    await fs.rename(path, join(root, 'original.bin'));
    await fs.writeFile(path, 'xyz');
    return handle;
  });
  try {
    await expectToRejectCode(hashFile(path), ERRORS.FILE_CHANGED);
    expect(read).not.toHaveBeenCalled();
    expect(handle.fd).toBe(-1);
  } finally {
    await handle.close();
  }
});

test.each([{}, { maxBytes: 3 }])(
  'growth is detected after reading at most one extra byte (%o)',
  async (options) => {
    const path = join(root, 'input.bin');
    await fs.writeFile(path, 'abc');
    const handle = await actual.open(path, 'r');
    const read = vi.spyOn(handle, 'read');
    vi.mocked(fs.open).mockResolvedValueOnce(handle);
    if (process.platform === 'win32') {
      vi.mocked(fs.lstat).mockImplementationOnce(actual.lstat);
    }
    vi.mocked(fs.lstat).mockImplementationOnce(async (...args) => {
      const initial = await actual.lstat(...args);
      await fs.appendFile(path, 'more than one byte');
      return initial;
    });
    try {
      await expectToRejectCode(hashFile(path, options), ERRORS.FILE_CHANGED);
      expect(read).toHaveBeenCalledTimes(2);
      expect(read).toHaveBeenNthCalledWith(1, expect.any(Buffer), 0, 3, 0);
      expect(read).toHaveBeenNthCalledWith(2, expect.any(Buffer), 0, 1, 3);
      expect(handle.fd).toBe(-1);
    } finally {
      await handle.close();
    }
  },
);

test('cancellation after opening preserves the reason and closes the descriptor', async () => {
  const path = join(root, 'input.bin');
  await fs.writeFile(path, 'abc');
  const handle = await actual.open(path, 'r');
  const controller = new AbortController();
  const reason = new Error('cancelled by the caller');
  vi.mocked(fs.open).mockImplementationOnce(() => {
    controller.abort(reason);
    return Promise.resolve(handle);
  });
  try {
    await expect(hashFile(path, { signal: controller.signal })).rejects.toBe(reason);
    expect(handle.fd).toBe(-1);
  } finally {
    await handle.close();
  }
});
