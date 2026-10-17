import { describe, expect, test } from 'vitest';

import { readWorkspacePatterns, sortByDependencies, type IWorkspacePackage } from './workspace.ts';

// builds a package that depends on the given siblings
const workspacePackage = (
  name: string,
  dependencies: Record<string, string> = {},
  peers: Record<string, string> = {},
): IWorkspacePackage => ({
  name,
  version: '1.0.0',
  directory: `/repo/packages/${name}`,
  manifest: { name, version: '1.0.0', dependencies, peerDependencies: peers },
});

describe('sortByDependencies', () => {
  test('puts every package after the siblings it depends on, then orders by name', () => {
    const packages = [
      workspacePackage('jg-fetch', { 'jg-api-response': 'workspace:^', 'jg-utils': 'workspace:^' }),
      workspacePackage('jg-utils', { 'jg-exception': 'workspace:^', uuid: '^14.0.3' }),
      workspacePackage('jg-api-response', { 'jg-exception': 'workspace:^' }),
      workspacePackage('jg-exception'),
      workspacePackage('jg-bignumber', {}, { 'jg-exception': 'workspace:^' }),
    ];

    expect(sortByDependencies(packages).map(({ name }) => name)).toStrictEqual([
      'jg-exception',
      'jg-api-response',
      'jg-bignumber',
      'jg-utils',
      'jg-fetch',
    ]);
  });

  test('rejects a dependency cycle', () => {
    expect(() =>
      sortByDependencies([
        workspacePackage('a', { b: 'workspace:^' }),
        workspacePackage('b', { a: 'workspace:^' }),
      ]),
    ).toThrow('The packages depend on each other in a cycle: a, b');
  });
});

describe('readWorkspacePatterns', () => {
  test('reads the packages list, quoted or not, and stops at the next key', () => {
    const yaml = [
      'packages:',
      '  - internal/*',
      "  - 'packages/*'",
      '',
      '  # the site',
      '  - "website"',
      '',
      'catalog:',
      '  - not-a-workspace',
      '',
    ].join('\n');

    expect(readWorkspacePatterns(yaml)).toStrictEqual(['internal/*', 'packages/*', 'website']);
  });

  test('reads nothing without a packages list', () => {
    expect(readWorkspacePatterns('catalog:\n  vitest: 5.0.5\n')).toStrictEqual([]);
  });
});
