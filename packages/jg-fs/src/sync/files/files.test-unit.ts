// @vitest-environment node
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { writeFileAtomicIfUnchanged } from './files.js';

// keeps the real filesystem, while letting a test make one open fail
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, openSync: vi.fn(actual.openSync) };
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
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  test('passes on an error reading the file back, other than a change, leaving it untouched', () => {
    const destination = join(directory, 'config.txt');
    fs.writeFileSync(destination, 'before');
    const denied = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    // the read-back opens the destination itself with numeric flags; the temporary file uses 'wx'
    vi.mocked(fs.openSync).mockImplementation((path, flags, mode) => {
      if (String(path) === destination && typeof flags === 'number') {
        throw denied;
      }
      return actualFs.openSync(path, flags, mode);
    });

    expect(() => writeFileAtomicIfUnchanged(destination, 'after', Buffer.from('before'))).toThrow(
      denied,
    );
    expect(fs.readFileSync(destination, 'utf8')).toBe('before');
    expect(fs.readdirSync(directory).filter((name) => name.endsWith('.tmp'))).toStrictEqual([]);
  });
});
