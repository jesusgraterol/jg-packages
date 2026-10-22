// @vitest-environment node
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { writeFileAtomicIfUnchanged } from './files.js';

// keeps the real filesystem, while letting a test make one open fail
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return {
    ...actual,
    openSync: vi.fn(actual.openSync),
    fchmodSync: vi.fn(actual.fchmodSync),
    writeFileSync: vi.fn(actual.writeFileSync),
  };
});

describe('writeFileAtomicIfUnchanged failures', () => {
  let actualFs: typeof fs;
  let directory: string;

  beforeAll(async () => {
    actualFs = await vi.importActual<typeof fs>('node:fs');
    directory = fs.mkdtempSync(join(tmpdir(), 'jg-fs-sync-'));
  });

  afterEach(() => {
    vi.mocked(fs.openSync).mockReset().mockImplementation(actualFs.openSync);
    vi.mocked(fs.fchmodSync).mockReset().mockImplementation(actualFs.fchmodSync);
    vi.mocked(fs.writeFileSync).mockReset().mockImplementation(actualFs.writeFileSync);
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test.skipIf(process.platform === 'win32')(
    'sets private permissions before writing any content to the temporary file',
    () => {
      const destination = join(directory, 'private.txt');
      fs.writeFileSync(destination, 'before', { mode: 0o644 });
      let modeAtWrite: number | undefined;
      vi.mocked(fs.writeFileSync).mockImplementationOnce((file, ...args) => {
        if (typeof file === 'number') {
          modeAtWrite = fs.fstatSync(file).mode & 0o777;
        }
        actualFs.writeFileSync(file, ...args);
      });

      writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600);

      expect(modeAtWrite).toBe(0o600);
      expect(fs.readFileSync(destination, 'utf8')).toBe('after');
    },
  );

  test('leaves the destination untouched and removes the temporary file when setting its mode fails', () => {
    const destination = join(directory, 'mode-failure.txt');
    fs.writeFileSync(destination, 'before');
    const modeBefore = fs.statSync(destination).mode;
    const denied = Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' });
    vi.mocked(fs.fchmodSync).mockImplementationOnce(() => {
      throw denied;
    });

    expect(() =>
      writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600),
    ).toThrow(denied);

    expect(fs.readFileSync(destination, 'utf8')).toBe('before');
    expect(fs.statSync(destination).mode).toBe(modeBefore);
    expect(fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toStrictEqual([]);
  });

  test('passes on an error reading the file back, other than a change, leaving it untouched', () => {
    const destination = join(directory, 'config.txt');
    fs.writeFileSync(destination, 'before');
    const modeBefore = fs.statSync(destination).mode;
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    // the read-back opens the destination itself with numeric flags; the temporary file uses 'wx'
    vi.mocked(fs.openSync).mockImplementation((path, flags, mode) => {
      if (String(path) === destination && typeof flags === 'number') {
        throw denied;
      }
      return actualFs.openSync(path, flags, mode);
    });

    expect(() =>
      writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'), 0o600),
    ).toThrow(denied);
    expect(fs.readFileSync(destination, 'utf8')).toBe('before');
    expect(fs.statSync(destination).mode).toBe(modeBefore);
    expect(fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toStrictEqual([]);
  });
});
