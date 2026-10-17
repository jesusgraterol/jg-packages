// @vitest-environment node
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { getPathElement, pathExists } from './general.js';

describe('General Actions', () => {
  let root: string;

  // builds a path inside of the base directory, which each test starts without
  const p = (path?: string): string =>
    typeof path === 'string' ? join(root, 'fs-test-dir', path) : join(root, 'fs-test-dir');

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'jg-fs-'));
  });

  beforeEach(async () => {
    await rm(p(), { recursive: true, force: true });
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('pathExists', () => {
    test('can determine if a path does not exist', async () => {
      expect(await pathExists(p())).toBe(false);
      expect(await pathExists(p('some-file.txt'))).toBe(false);
    });

    test('can determine if a path exists', async () => {
      await mkdir(p());
      expect(await pathExists(p())).toBe(true);
      await writeFile(p('some-file.txt'), 'Hello World!');
      expect(await pathExists(p('some-file.txt'))).toBe(true);
    });
  });

  describe('getPathElement', () => {
    test('resolves to null when a path element does not exist', async () => {
      expect(await getPathElement(p())).toBeNull();
      expect(await getPathElement(p('test-file.txt'))).toBeNull();
    });

    test("can read a directory's element", async () => {
      await mkdir(p());
      const el = await getPathElement(p());
      expect(el).toStrictEqual({
        path: p(),
        baseName: 'fs-test-dir',
        extName: '',
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        size: expect.any(Number) as number,
        creation: expect.any(Number) as number,
      });
    });

    test("can read a file's element", async () => {
      await mkdir(p());
      await writeFile(p('test-file.txt'), 'Hello World!!');
      const el = await getPathElement(p('test-file.txt'));
      expect(el).toStrictEqual({
        path: p('test-file.txt'),
        baseName: 'test-file.txt',
        extName: '.txt',
        isFile: true,
        isDirectory: false,
        isSymbolicLink: false,
        size: 13,
        creation: expect.any(Number) as number,
      });
    });
  });
});
