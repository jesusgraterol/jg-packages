import { describe, expect, test } from 'vitest';

import { createTarball } from '../test-utils/tarball.ts';
import { readTarballFiles } from './tarball.ts';

describe('readTarballFiles', () => {
  test('reads every file without the package prefix and skips directories', async () => {
    const files = await readTarballFiles(
      createTarball({ 'package.json': '{"name":"a"}', 'dist/index.js': 'export {};' }, ['dist']),
    );

    expect([...files.keys()]).toStrictEqual(['package.json', 'dist/index.js']);
    expect(files.get('dist/index.js')?.toString('utf8')).toBe('export {};');
  });

  test('reads paths longer than 100 bytes from their PAX header', async () => {
    const longPath = `dist/${'nested/'.repeat(16)}index.js`;

    const files = await readTarballFiles(createTarball({ [longPath]: 'deep' }));

    expect([...files.keys()]).toStrictEqual([longPath]);
  });

  test('keeps binary contents byte for byte, including content that spans blocks', async () => {
    const binary = Buffer.from(Array.from({ length: 1500 }, (_, index) => index % 256));

    const files = await readTarballFiles(createTarball({ 'assets/logo.bin': binary }));

    expect(files.get('assets/logo.bin')?.equals(binary)).toBe(true);
  });

  test('rejects a truncated archive', async () => {
    const { gunzipSync, gzipSync } = await import('node:zlib');
    const archive = gunzipSync(createTarball({ 'package.json': 'x'.repeat(2000) }));

    await expect(readTarballFiles(gzipSync(archive.subarray(0, 1024)))).rejects.toThrow(
      'The tarball is not a valid tar archive.',
    );
  });
});
