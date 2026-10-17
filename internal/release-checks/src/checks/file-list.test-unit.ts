import { describe, expect, test } from 'vitest';

import { checkFileList } from './file-list.ts';
import type { IPackageManifest } from '../shared/types.ts';

// builds a file map from paths
const toFiles = (paths: string[]): Map<string, Buffer> =>
  new Map(paths.map((path) => [path, Buffer.from('x')]));

const MANIFEST: IPackageManifest = {
  name: 'jg-sample',
  version: '1.0.0',
  files: ['dist', '!dist/**/*.test-*'],
  exports: {
    '.': { types: './dist/index.d.ts', default: './dist/index.js' },
    './sync': { types: './dist/sync/index.d.ts', default: './dist/sync/index.js' },
  },
  bin: { 'jg-sample': './dist/cli/cli.js' },
};

const SHIPPED = [
  'package.json',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
  'dist/index.js',
  'dist/index.d.ts',
  'dist/sync/index.js',
  'dist/sync/index.d.ts',
  'dist/cli/cli.js',
];

describe('checkFileList', () => {
  test('accepts the docs, the files allowlist, and every target', () => {
    expect(checkFileList(MANIFEST, toFiles(SHIPPED))).toStrictEqual([]);
  });

  test('reports files outside the allowlist', () => {
    expect(
      checkFileList(MANIFEST, toFiles([...SHIPPED, 'src/index.ts', 'distribution.txt'])),
    ).toStrictEqual([
      'ships a file outside `files`: src/index.ts',
      'ships a file outside `files`: distribution.txt',
    ]);
  });

  test('reports test files and build info even inside the allowlist', () => {
    expect(
      checkFileList(
        MANIFEST,
        toFiles([...SHIPPED, 'dist/index.test-unit.js', 'dist/tsconfig.tsbuildinfo']),
      ),
    ).toStrictEqual([
      'ships a test or build-info file: dist/index.test-unit.js',
      'ships a test or build-info file: dist/tsconfig.tsbuildinfo',
    ]);
  });

  test('reports missing exports and bin targets', () => {
    const shipped = SHIPPED.filter(
      (path) => path !== 'dist/sync/index.d.ts' && path !== 'dist/cli/cli.js',
    );

    expect(checkFileList(MANIFEST, toFiles(shipped))).toStrictEqual([
      'is missing an `exports` or `bin` target: ./dist/sync/index.d.ts',
      'is missing an `exports` or `bin` target: ./dist/cli/cli.js',
    ]);
  });
});
