// @vitest-environment node
import { realpathSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToThrowCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runProcess } from '../run-process/index.js';
import { ERRORS } from '../shared/index.js';

import { resolvePackageManagerCommand, searchPath } from './package-manager.js';

// executable bits exist only on POSIX
const IS_WINDOWS = process.platform === 'win32';

describe('package manager lookup on disk', () => {
  let directory: string;

  // writes a file, creating its directory, and returns its path
  const writeFixture = async (path: string, contents: string): Promise<string> => {
    const fullPath = join(directory, path);
    await mkdir(join(fullPath, '..'), { recursive: true });
    await writeFile(fullPath, contents);
    return fullPath;
  };

  // writes a package manager's package.json, with its bin
  const writePackage = (path: string, name: string, bin: unknown): Promise<string> =>
    writeFixture(join(path, 'package.json'), JSON.stringify({ name, version: '1.0.0', bin }));

  beforeEach(async () => {
    // macOS keeps the temporary directory behind a symbolic link, so paths are compared real
    directory = realpathSync(await mkdtemp(join(tmpdir(), 'jg-process-pm-')));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  test.skipIf(IS_WINDOWS)('finds an executable on PATH, and runs it directly', async () => {
    const pnpm = await writeFixture('bin/pnpm', '#!/bin/sh\n');
    await chmod(pnpm, 0o755);

    expect(
      resolvePackageManagerCommand(['-v'], {
        packageManager: 'pnpm',
        env: { PATH: ['/nonexistent', join(directory, 'bin')].join(':') },
        cwd: directory,
      }),
    ).toStrictEqual({ command: pnpm, args: ['-v'] });
  });

  test.skipIf(IS_WINDOWS)('skips a file on PATH that is not executable', async () => {
    await writeFixture('bin/pnpm', '#!/bin/sh\n');

    expectToThrowCode(
      () =>
        resolvePackageManagerCommand([], {
          packageManager: 'pnpm',
          env: { PATH: join(directory, 'bin') },
          cwd: directory,
        }),
      ERRORS.PACKAGE_MANAGER_NOT_FOUND,
    );
  });

  test("prefers the project's own install, run through this Node.js", async () => {
    await writePackage('node_modules/pnpm', 'pnpm', { pnpm: 'bin/pnpm.cjs' });
    const entry = await writeFixture('node_modules/pnpm/bin/pnpm.cjs', '');

    expect(
      resolvePackageManagerCommand(['install'], {
        packageManager: 'pnpm',
        env: { PATH: '' },
        cwd: directory,
      }),
    ).toStrictEqual({ command: process.execPath, args: [entry, 'install'] });
  });

  test("reads a package's bin given as a string", async () => {
    await writePackage('node_modules/yarn', 'yarn', 'bin/yarn.js');
    const entry = await writeFixture('node_modules/yarn/bin/yarn.js', '');

    expect(
      resolvePackageManagerCommand([], {
        packageManager: 'yarn',
        env: { PATH: '' },
        cwd: directory,
      }),
    ).toStrictEqual({ command: process.execPath, args: [entry] });
  });

  test.each([
    ['a manifest that is not an object', 'null'],
    ['another package in its place', JSON.stringify({ name: 'not-pnpm', bin: 'bin/pnpm.cjs' })],
  ])('ignores an install with %s', async (_, manifest) => {
    await writeFixture('node_modules/pnpm/package.json', manifest);
    await writeFixture('node_modules/pnpm/bin/pnpm.cjs', '');

    expectToThrowCode(
      () =>
        resolvePackageManagerCommand([], {
          packageManager: 'pnpm',
          env: { PATH: '' },
          cwd: directory,
        }),
      ERRORS.PACKAGE_MANAGER_NOT_FOUND,
    );
  });

  test.each([
    ['a bin outside the package', { pnpm: '../evil.js' }],
    ['a bin that does not exist', { pnpm: 'bin/missing.cjs' }],
    ['no bin for the package manager', { other: 'bin/pnpm.cjs' }],
  ])('ignores an install with %s', async (_, bin) => {
    await writePackage('node_modules/pnpm', 'pnpm', bin);
    await writeFixture('node_modules/evil.js', '');

    expectToThrowCode(
      () =>
        resolvePackageManagerCommand([], {
          packageManager: 'pnpm',
          env: { PATH: '' },
          cwd: directory,
        }),
      ERRORS.PACKAGE_MANAGER_NOT_FOUND,
    );
  });

  describe('on Windows PATH rules', () => {
    test('runs an .exe directly', async () => {
      const executable = await writeFixture('bin/bun.exe', '');

      expect(searchPath({ Path: join(directory, 'bin') }, 'bun', 'win32', ['-v'])).toStrictEqual({
        command: executable,
        args: ['-v'],
      });
    });

    test('runs the script a cmd-shim names through Node.js, and never the .cmd itself', async () => {
      const target = await writeFixture('pnpm-home/pnpm/bin/pnpm.cjs', '');
      await writeFixture(
        'pnpm-home/pnpm.cmd',
        '@ECHO off\r\n# cmd-shim-target=pnpm\\..\\pnpm\\bin\\pnpm.cjs\r\nnode %*\r\n'.replaceAll(
          '\\',
          '/',
        ),
      );

      expect(
        searchPath({ PATH: join(directory, 'pnpm-home') }, 'pnpm', 'win32', ['-v']),
      ).toStrictEqual({ command: process.execPath, args: [target, '-v'] });
    });

    test("finds npm's package next to its shim, in node_modules", async () => {
      await writeFixture(
        'nodejs/npm.cmd',
        '@ECHO off\r\nnode "%~dp0\\node_modules\\npm\\bin\\npm-cli.js" %*',
      );
      await writePackage('nodejs/node_modules/npm', 'npm', { npm: 'bin/npm-cli.js' });
      const entry = await writeFixture('nodejs/node_modules/npm/bin/npm-cli.js', '');

      expect(searchPath({ PATH: join(directory, 'nodejs') }, 'npm', 'win32', [])).toStrictEqual({
        command: process.execPath,
        args: [entry],
      });
    });

    test("walks up from a shim to its package manager's package", async () => {
      await writePackage('tools/pnpm', 'pnpm', { pnpm: 'bin/pnpm.cjs' });
      const entry = await writeFixture('tools/pnpm/bin/pnpm.cjs', '');
      await writeFixture('tools/pnpm/bin/shims/pnpm.ps1', '# a PowerShell shim\n');

      expect(
        searchPath({ PATH: join(directory, 'tools/pnpm/bin/shims') }, 'pnpm', 'win32', []),
      ).toStrictEqual({ command: process.execPath, args: [entry] });
    });

    test('skips a shim with neither a target nor a package to find', async () => {
      await writeFixture('lonely/pnpm.cmd', '@ECHO off\r\nnode pnpm.cjs %*');

      expect(searchPath({ PATH: join(directory, 'lonely') }, 'pnpm', 'win32', [])).toBeUndefined();
    });

    test('skips a shim larger than any real one', async () => {
      await writeFixture('big/pnpm.cmd', `# cmd-shim-target=x.cjs\n${'x'.repeat(16_385)}`);
      await writeFixture('big/x.cjs', '');

      expect(searchPath({ PATH: join(directory, 'big') }, 'pnpm', 'win32', [])).toBeUndefined();
    });
  });

  test('runs the package manager running these tests', async () => {
    const command = resolvePackageManagerCommand(['--version'], { packageManager: 'pnpm' });

    const { exitCode, stdout } = await runProcess({ ...command, timeoutSeconds: 60 });

    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/u);
  });
});
