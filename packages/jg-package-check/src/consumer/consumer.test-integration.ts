import { chmod, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getErrorCode } from 'jg-exception';
import { expectToRejectCode } from 'jg-exception/testing';
import { resolvePackageManagerCommand, runProcess } from 'jg-process';
import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  ERRORS,
  checkPackedExports,
  inspectNpmTarball,
  withPackedConsumer,
  type IPackedConsumer,
  type IPackedConsumerOptions,
} from '../index.js';

let fixtures: string;

beforeEach(async () => {
  fixtures = await mkdtemp(join(tmpdir(), 'jg-package-fixture-'));
});

afterEach(async () => {
  await rm(fixtures, { recursive: true, force: true });
});

const configureFixture = async (consumer: IPackedConsumer): Promise<void> => {
  consumer.env['NPM_CONFIG_USERCONFIG'] = join(consumer.directory, 'empty.npmrc');
  consumer.env['NPM_CONFIG_CACHE'] = join(consumer.directory, 'npm-cache');
  consumer.env['XDG_CACHE_HOME'] = join(consumer.directory, 'pnpm-cache');
  consumer.env['XDG_DATA_HOME'] = join(consumer.directory, 'pnpm-data');
  consumer.env['NPM_CONFIG_STORE_DIR'] = join(consumer.directory, 'pnpm-store');
  await writeFile(consumer.env['NPM_CONFIG_USERCONFIG'], '');
};

const pack = async (
  name: string,
  manifest: Record<string, unknown>,
  files: Record<string, string>,
): Promise<string> => {
  const cwd = join(fixtures, name);
  await mkdir(cwd);
  await writeFile(
    join(cwd, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', type: 'module', ...manifest }),
  );
  for (const [path, text] of Object.entries(files)) await writeFile(join(cwd, path), text);
  const packResult = await runProcess({
    ...resolvePackageManagerCommand(
      ['pack', '--ignore-scripts', '--offline', '--json', '--pack-destination', fixtures],
      { packageManager: 'npm' },
    ),
    cwd,
    env: { ...process.env, NPM_CONFIG_CACHE: join(fixtures, 'pack-cache') },
    timeoutSeconds: 15,
  });
  expect(packResult.exitCode, packResult.stderr || packResult.stdout).toBe(0);
  return join(fixtures, `${name}-1.0.0.tgz`);
};

const toOptions = (
  tarballs: string[],
  packageManager: IPackedConsumerOptions['packageManager'] = 'npm',
): IPackedConsumerOptions => ({
  packageManager,
  tarballs,
  offline: true,
  prepare: configureFixture,
});

const fixtureOptions = async (): Promise<IPackedConsumerOptions> =>
  toOptions([
    await pack('jg-check-fixture', { exports: './index.js' }, { 'index.js': 'export default 1;' }),
  ]);

test.each(['npm', 'pnpm'] as const)(
  'qualifies a packed library and CLI together with %s',
  async (packageManager) => {
    const library = await pack(
      'jg-check-lib',
      { exports: { '.': './index.js', './feature': './feature.js' } },
      {
        'README.md': '# Release fixture',
        'index.d.ts': 'export const answer: number;',
        'index.js': 'export const answer = 42;',
        'feature.js': 'export const feature = true;',
        'private.js': 'export const secret = false;',
      },
    );
    const cli = await pack(
      'jg-check-cli',
      {
        exports: './index.js',
        bin: { 'jg-check-cli': './index.js' },
        scripts: {
          preinstall: 'node -e "process.exit(99)"',
          install: 'node -e "process.exit(98)"',
          postinstall: 'node -e "process.exit(97)"',
        },
        dependencies: { 'jg-check-lib': '1.0.0' },
        devDependencies: { 'jg-check-dev': 'workspace:^' },
      },
      {
        'index.js':
          '#!/usr/bin/env node\nimport {answer} from "jg-check-lib"; if (process.argv.includes("--help")) console.log(answer);',
      },
    );

    const payload = await inspectNpmTarball(await readFile(library));
    expect([...payload.keys()].sort()).toStrictEqual([
      'README.md',
      'feature.js',
      'index.d.ts',
      'index.js',
      'package.json',
      'private.js',
    ]);
    const directory = await withPackedConsumer(
      {
        ...toOptions([library, cli], packageManager),
        prepare: async (consumer) => {
          await configureFixture(consumer);
          if (packageManager === 'pnpm') {
            await writeFile(
              join(consumer.directory, 'pnpm-workspace.yaml'),
              `overrides:\n  jg-check-lib: ${JSON.stringify(`file:${library}`)}\n`,
            );
          }
        },
      },
      async (consumer) => {
        for (const [path, bytes] of payload) {
          expect(
            await readFile(join(consumer.directory, 'node_modules', 'jg-check-lib', path)),
          ).toStrictEqual(bytes);
        }
        expect(
          await checkPackedExports(consumer, {
            packageName: 'jg-check-lib',
            importSubpaths: ['.', './feature'],
            privateSubpaths: ['./private.js'],
          }),
        ).toStrictEqual([]);
        expect(
          await checkPackedExports(consumer, {
            packageName: 'jg-check-cli',
            importSubpaths: ['.'],
          }),
        ).toStrictEqual(['installs with an unpublished range: jg-check-dev@workspace:^']);
        expect(
          await checkPackedExports(consumer, {
            packageName: 'jg-check-lib',
            importSubpaths: ['./missing'],
            privateSubpaths: ['./feature'],
          }),
        ).toEqual([
          expect.stringContaining("can't be imported as jg-check-lib/missing"),
          expect.stringContaining(
            "importing jg-check-lib/feature didn't fail with ERR_PACKAGE_PATH_NOT_EXPORTED",
          ),
        ]);

        const binResult = await runProcess({
          command: process.execPath,
          args: [join(consumer.directory, 'node_modules', 'jg-check-cli', 'index.js'), '--help'],
          cwd: consumer.directory,
          env: consumer.env,
          timeoutSeconds: 10,
        });
        expect(binResult).toMatchObject({ exitCode: 0, stdout: '42\n', stderr: '' });
        return consumer.directory;
      },
    );
    await expect(lstat(directory)).rejects.toHaveProperty('code', 'ENOENT');
  },
  25_000,
);

test('removes the consumer and retains the original callback failure', async () => {
  const options = await fixtureOptions();
  const failure = new Error('consumer assertion failed');
  let directory = '';
  await expect(
    withPackedConsumer(options, async (consumer) => {
      directory = consumer.directory;
      await Promise.resolve();
      throw failure;
    }),
  ).rejects.toBe(failure);
  expect(directory).not.toBe('');
  await expect(lstat(directory)).rejects.toHaveProperty('code', 'ENOENT');
});

test('cleans failed setup and preserves the stable setup error', async () => {
  const options = await fixtureOptions();
  let directory = '';
  await expectToRejectCode(
    withPackedConsumer(
      {
        ...options,
        prepare: async (consumer) => {
          directory = consumer.directory;
          await writeFile(join(directory, 'prepare-marker'), 'present');
          throw new Error('fixture could not be prepared');
        },
      },
      () => Promise.resolve('unexpected'),
    ),
    ERRORS.PACKED_CONSUMER_SETUP_FAILED,
    'fixture could not be prepared',
  );
  expect(directory).not.toBe('');
  await expect(lstat(directory)).rejects.toHaveProperty('code', 'ENOENT');
});

test.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
  'reports the directory and both failures when a real permission error prevents cleanup',
  async () => {
    const options = await fixtureOptions();
    let directory = '';
    let restricted = '';
    const failure = new Error('consumer checks failed');
    try {
      const operation = withPackedConsumer(options, async (consumer) => {
        directory = consumer.directory;
        restricted = join(directory, 'restricted');
        await mkdir(restricted);
        await writeFile(join(restricted, 'child'), 'keep');
        await chmod(restricted, 0o500);
        throw failure;
      });
      await expect(operation).rejects.toMatchObject({
        code: ERRORS.PACKED_CONSUMER_CLEANUP_FAILED,
        cause: { errors: [{ code: 'EACCES' }, failure] },
      });
      await expect(operation).rejects.toHaveProperty('data.directory', directory);
      expect(await readFile(join(restricted, 'child'), 'utf8')).toBe('keep');
    } finally {
      if (restricted) await chmod(restricted, 0o700);
      if (directory) await rm(directory, { recursive: true, force: true });
    }
    await expect(lstat(directory)).rejects.toSatisfy((error) => getErrorCode(error) === 'ENOENT');
  },
);
