import { describe, expect, test } from 'vitest';

import { buildAttwArguments } from './packaging-lint.ts';

// the arguments every package gets
const PLAIN = [
  '/tmp/jg-sample-1.0.0.tgz',
  '--profile',
  'esm-only',
  '--format',
  'ascii',
  '--no-color',
  '--no-emoji',
];

describe('buildAttwArguments', () => {
  test('gives a package whose subpaths are all JavaScript the plain command', () => {
    expect(
      buildAttwArguments('/tmp/jg-sample-1.0.0.tgz', {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './sync': { types: './dist/sync/index.d.ts', default: './dist/sync/index.js' },
      }),
    ).toStrictEqual(PLAIN);
  });

  test('excludes only the stylesheet, so `.` and the JavaScript subpaths stay checked', () => {
    expect(
      buildAttwArguments('/tmp/jg-sample-1.0.0.tgz', {
        '.': { types: './dist/index.d.ts', default: './dist/index.js' },
        './styles.css': './dist/page-outlet/styles.css',
        './sync': { types: './dist/sync/index.d.ts', default: './dist/sync/index.js' },
      }),
    ).toStrictEqual([...PLAIN, '--exclude-entrypoints', './styles.css']);
  });
});
