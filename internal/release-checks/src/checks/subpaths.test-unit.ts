import { describe, expect, test } from 'vitest';

import { getImportableSubpaths, getNonJavaScriptSubpaths } from './subpaths.ts';

const EXPORTS = {
  '.': { types: './dist/index.d.ts', default: './dist/index.js' },
  './sync': { types: './dist/sync/index.d.ts', default: './dist/sync/index.mjs' },
  './cli': './dist/cli/cli.js',
  './styles.css': './dist/page-outlet/styles.css',
  './theme.css': { style: './src/theme.css', default: './src/theme.css' },
  './button': './src/button/button.astro',
  './types': { types: './dist/types.d.ts' },
};

describe('getImportableSubpaths', () => {
  test('lists the subpaths whose default target is JavaScript, as a path or a condition', () => {
    expect(getImportableSubpaths(EXPORTS)).toStrictEqual(['.', './sync', './cli']);
  });

  test.each([[undefined], [null], ['./dist/index.js']])(
    'getImportableSubpaths(%s) -> []',
    (exportsMap) => {
      expect(getImportableSubpaths(exportsMap)).toStrictEqual([]);
    },
  );
});

describe('getNonJavaScriptSubpaths', () => {
  test('lists every other subpath, such as stylesheets and sources, and never a JavaScript one', () => {
    expect(getNonJavaScriptSubpaths(EXPORTS)).toStrictEqual([
      './styles.css',
      './theme.css',
      './button',
      './types',
    ]);
  });

  test('is empty when every subpath is JavaScript', () => {
    expect(
      getNonJavaScriptSubpaths({ '.': { types: './dist/index.d.ts', default: './dist/index.js' } }),
    ).toStrictEqual([]);
  });
});
