// @vitest-environment node
import { join } from 'node:path';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { resolvePackageManagerCommand } from './package-manager.js';
import type { IPackageManager } from './types.js';
import { isInside, namesPackageManager, readShimTarget, toCommand } from './utilities.js';

// a directory without a package.json or node_modules anywhere above it
const NOWHERE = join('/', 'nonexistent-jg-process-directory');

// an environment with a package manager's entry and an empty PATH, so nothing else is found
const withExecPath = (execPath: string): NodeJS.ProcessEnv => ({
  npm_execpath: execPath,
  PATH: '',
});

describe('resolvePackageManagerCommand', () => {
  test.each([
    ['/opt/pnpm/bin/pnpm.cjs', 'pnpm'],
    ['/usr/lib/node_modules/npm/bin/npm-cli.js', 'npm'],
    ['/repo/.yarn/releases/yarn-4.5.0.cjs', 'yarn'],
    ['/opt/pnpm/bin/pnpm.mjs', 'pnpm'],
  ] as const)('runs the JavaScript entry %s through this Node.js', (execPath, packageManager) => {
    expect(
      resolvePackageManagerCommand(['run', 'build'], {
        packageManager,
        env: withExecPath(execPath),
        cwd: NOWHERE,
      }),
    ).toStrictEqual({ command: process.execPath, args: [execPath, 'run', 'build'] });
  });

  test('runs a native entry, such as bun, directly', () => {
    expect(
      resolvePackageManagerCommand(['install'], {
        packageManager: 'bun',
        env: withExecPath('/usr/local/bin/bun'),
        cwd: NOWHERE,
      }),
    ).toStrictEqual({ command: '/usr/local/bin/bun', args: ['install'] });
  });

  test('uses whichever package manager npm_execpath names when none is requested', () => {
    expect(
      resolvePackageManagerCommand(['test'], { env: withExecPath('/opt/pnpm/bin/pnpm.cjs') }),
    ).toStrictEqual({ command: process.execPath, args: ['/opt/pnpm/bin/pnpm.cjs', 'test'] });
  });

  test('ignores an npm_execpath that names another package manager', () => {
    expectToThrowCode(
      () =>
        resolvePackageManagerCommand(['test'], {
          packageManager: 'npm',
          env: withExecPath('/opt/pnpm/bin/pnpm.cjs'),
          cwd: NOWHERE,
        }),
      ERRORS.PACKAGE_MANAGER_NOT_FOUND,
      "The npm executable couldn't be found.",
    );
  });

  test.each([
    'C:\\pnpm\\pnpm.cmd',
    'C:\\pnpm\\pnpm.CMD',
    'C:\\pnpm\\pnpm.bat',
    'C:\\pnpm\\pnpm.ps1',
  ])('never runs the Windows script %s that npm_execpath names', (execPath) => {
    expectToThrowCode(
      () => resolvePackageManagerCommand([], { env: withExecPath(execPath), cwd: NOWHERE }),
      ERRORS.PACKAGE_MANAGER_NOT_FOUND,
    );
  });

  test('throws with no package manager to look for', () => {
    let error: unknown;
    try {
      resolvePackageManagerCommand([], { env: { PATH: '' }, cwd: NOWHERE });
    } catch (caught) {
      error = caught;
    }

    expect(error).toMatchObject({
      code: ERRORS.PACKAGE_MANAGER_NOT_FOUND,
      message: "The package manager executable couldn't be found.",
      data: { packageManager: null },
    });
  });

  test.each(['deno', 'PNPM', ''])('rejects the package manager %j', (packageManager) => {
    expectToThrowCode(
      () => resolvePackageManagerCommand([], { packageManager: packageManager as IPackageManager }),
      ERRORS.UNSUPPORTED_PACKAGE_MANAGER,
      'The package manager must be pnpm, npm, yarn, or bun.',
    );
  });
});

describe('utilities', () => {
  test.each([
    ['/opt/pnpm/bin/pnpm.cjs', 'pnpm', true],
    ['C:\\Users\\a\\pnpm\\PNPM.CJS', 'pnpm', true],
    ['/usr/lib/node_modules/npm/bin/npm-cli.js', 'npm', true],
    ['/usr/lib/node_modules/npm/bin/npx-cli.js', 'npm', false],
    ['/opt/pnpm/bin/pnpm.cjs', 'npm', false],
    ['/repo/.yarn/releases/yarn-4.5.0.cjs', 'yarn', true],
    ['/usr/local/bin/bun', 'bun', true],
  ] as const)('namesPackageManager(%s, %s) -> %s', (entry, packageManager, expected) => {
    expect(namesPackageManager(entry, packageManager)).toBe(expected);
  });

  test.each([
    [
      '@ECHO off\r\n# cmd-shim-target=..\\pnpm\\bin\\pnpm.cjs\r\nnode %*',
      '..\\pnpm\\bin\\pnpm.cjs',
    ],
    [
      '#!/bin/sh\n# cmd-shim-target=/opt/pnpm/bin/pnpm.cjs\nexec node "$@"',
      '/opt/pnpm/bin/pnpm.cjs',
    ],
    ['@ECHO off\r\nnode "%~dp0\\node_modules\\npm\\bin\\npm-cli.js" %*', undefined],
    ['# cmd-shim-target=   \n', undefined],
    ['', undefined],
  ])('readShimTarget(%j) -> %s', (shim, expected) => {
    expect(readShimTarget(shim)).toBe(expected);
  });

  test.each([
    ['/repo/node_modules/pnpm', '/repo/node_modules/pnpm/bin/pnpm.cjs', true],
    ['/repo/node_modules/pnpm', '/repo/node_modules/pnpm', true],
    ['/repo/node_modules/pnpm', '/repo/node_modules/evil.js', false],
    ['/repo/node_modules/pnpm', '/repo/node_modules/pnpm-evil/x.js', false],
  ])('isInside(%s, %s) -> %s', (directory, path, expected) => {
    expect(isInside(directory, path)).toBe(expected);
  });

  test('runs a JavaScript entry through this Node.js, and anything else directly', () => {
    expect(toCommand('/a/pnpm.CJS', ['-v'])).toStrictEqual({
      command: process.execPath,
      args: ['/a/pnpm.CJS', '-v'],
    });
    expect(toCommand('/a/pnpm', ['-v'])).toStrictEqual({ command: '/a/pnpm', args: ['-v'] });
  });
});
