import { Buffer } from 'node:buffer';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Exception } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { ERRORS, installVerifiedFile } from '../../index.js';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    link: vi.fn(actual.link),
    lstat: vi.fn(actual.lstat),
    open: vi.fn(actual.open),
  };
});

const actual = await vi.importActual<typeof fs>('node:fs/promises');
const ABC = { size: 3, sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' };
const EMPTY = {
  size: 0,
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
};
let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'jg-fs-install-'));
});

afterEach(async () => {
  vi.mocked(fs.link).mockReset().mockImplementation(actual.link);
  vi.mocked(fs.lstat).mockReset().mockImplementation(actual.lstat);
  vi.mocked(fs.open).mockReset().mockImplementation(actual.open);
  await fs.rm(root, { recursive: true, force: true });
});

test('installs a multichunk file and later reuses it without a source', async () => {
  const source = join(root, 'source.bin');
  const destination = join(root, 'destination.bin');
  const bytes = Buffer.alloc(131_073, 97);
  const expected = {
    size: bytes.length,
    sha256: '7e009ea4ef882e385b3c0bcbbfa8d009bb0a633bdd764415c09182ee0e75da73',
  };
  await fs.writeFile(source, bytes);
  await installVerifiedFile(source, destination, expected);
  await fs.unlink(source);
  await installVerifiedFile(source, destination, expected);
  expect(await fs.readFile(destination)).toStrictEqual(bytes);
  expect(await fs.readdir(root)).toStrictEqual(['destination.bin']);
});

test('preserves an occupied destination with different bytes', async () => {
  const source = join(root, 'missing.bin');
  const destination = join(root, 'destination.bin');
  await fs.writeFile(destination, 'xyz');
  await expectToRejectCode(
    installVerifiedFile(source, destination, ABC),
    ERRORS.FILE_ALREADY_EXISTS,
  );
  expect(await fs.readFile(destination, 'utf8')).toBe('xyz');
  expect(await fs.readdir(root)).toStrictEqual(['destination.bin']);
});

test('reuses a matching file when another installer removes its staging alias during the read', async () => {
  const alias = join(root, 'other-stage.bin');
  const destination = join(root, 'destination.bin');
  await fs.writeFile(alias, 'abc');
  await actual.link(alias, destination);

  let removedAlias = false;
  vi.mocked(fs.lstat).mockImplementation(async (...args) => {
    const stats = await actual.lstat(...args);
    if (args[0] === destination && args[1]?.bigint && !removedAlias) {
      removedAlias = true;
      await fs.unlink(alias);
    }
    return stats;
  });
  await installVerifiedFile(join(root, 'missing.bin'), destination, ABC);
  expect(await fs.readFile(destination, 'utf8')).toBe('abc');
  expect(await fs.readdir(root)).toStrictEqual(['destination.bin']);
});

test('validates the identity before touching either path', async () => {
  await expectToRejectCode(
    installVerifiedFile(join(root, 'source.bin'), join(root, 'destination.bin'), {
      ...ABC,
      sha256: ABC.sha256.toUpperCase(),
    }),
    ERRORS.INVALID_FILE_IDENTITY,
    'The expected file identity must contain a non-negative safe integer size and a lowercase SHA-256 digest.',
  );
  expect(await fs.readdir(root)).toStrictEqual([]);
});

test.each(['a', 'xyz', 'abcd'])(
  'removes the staged file if the source holds %s instead of abc',
  async (text) => {
    const source = join(root, 'source.bin');
    await fs.writeFile(source, text);
    await expectToRejectCode(
      installVerifiedFile(source, join(root, 'destination.bin'), ABC),
      ERRORS.FILE_CONTENT_MISMATCH,
      'The file does not match the expected size and SHA-256 digest.',
    );
    expect(await fs.readdir(root)).toStrictEqual(['source.bin']);
  },
);

test('cancellation while staging keeps the reason and removes the partial output', async () => {
  const source = join(root, 'source.bin');
  await fs.writeFile(source, 'abc');
  const controller = new AbortController();
  const reason = new Exception('cancelled by the caller', { code: ERRORS.FILE_TOO_LARGE });
  vi.mocked(fs.open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    if (args[0] === source) {
      controller.abort(reason);
    }
    return handle;
  });
  await expect(
    installVerifiedFile(source, join(root, 'destination.bin'), ABC, { signal: controller.signal }),
  ).rejects.toBe(reason);
  expect(await fs.readdir(root)).toStrictEqual(['source.bin']);
});

test.each([true, false])(
  'concurrent installs with matching identity %s preserve one destination',
  async (matches) => {
    const first = join(root, 'first.bin');
    const second = join(root, 'second.bin');
    const destination = join(root, 'destination.bin');
    await fs.writeFile(first, 'abc');
    await fs.writeFile(second, matches ? 'abc' : '');

    // both installers reach the real no-replace link with verified staged bytes
    let bothReady: () => void;
    const ready = new Promise<void>((resolve) => {
      bothReady = resolve;
    });
    let arrivals = 0;
    vi.mocked(fs.link).mockImplementation(async (sourcePath, destinationPath) => {
      if (++arrivals === 2) {
        bothReady();
      }
      await ready;
      await actual.link(sourcePath, destinationPath);
    });

    const installs = [
      installVerifiedFile(first, destination, ABC),
      installVerifiedFile(second, destination, matches ? ABC : EMPTY),
    ] as const;
    const results = await Promise.allSettled(installs);
    const installed = await fs.readFile(destination, 'utf8');
    if (matches) {
      expect(results).toStrictEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'fulfilled', value: undefined },
      ]);
      expect(installed).toBe('abc');
    } else {
      const winner = installed === 'abc' ? 0 : 1;
      expect(results[winner]).toStrictEqual({ status: 'fulfilled', value: undefined });
      await expectToRejectCode(installs[winner === 0 ? 1 : 0], ERRORS.FILE_ALREADY_EXISTS);
      expect(['abc', '']).toContain(installed);
    }
    expect((await fs.readdir(root)).sort()).toStrictEqual([
      'destination.bin',
      'first.bin',
      'second.bin',
    ]);
  },
);
