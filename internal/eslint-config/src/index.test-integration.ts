import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createEslintConfig } from './index.ts';

let packageDirectory: string;

// writes a minimal package with a strict tsconfig, so type-aware rules have a program to use
const writeFixturePackage = async (files: Record<string, string>): Promise<void> => {
  await writeFile(
    join(packageDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        types: [],
        noEmit: true,
      },
      include: ['src'],
    }),
  );
  await mkdir(join(packageDirectory, 'src'), { recursive: true });
  await mkdir(join(packageDirectory, 'dist'), { recursive: true });
  await Promise.all(
    Object.entries(files).map(([path, content]) =>
      writeFile(join(packageDirectory, path), content),
    ),
  );
};

// lints the fixture package with the factory's configuration and returns the rule ids it reported
const lintRuleIds = async (
  patterns: string[],
  serviceWorkerFiles?: string[],
): Promise<Record<string, string[]>> => {
  const eslint = new ESLint({
    cwd: packageDirectory,
    overrideConfigFile: true,
    overrideConfig: createEslintConfig({
      rootDirectory: packageDirectory,
      ...(serviceWorkerFiles === undefined ? {} : { serviceWorkerFiles }),
    }),
  });
  const results = await eslint.lintFiles(patterns);
  return Object.fromEntries(
    results.map((result) => [
      result.filePath.slice(packageDirectory.length + 1).replaceAll('\\', '/'),
      result.messages.map((message) => message.ruleId ?? message.message),
    ]),
  );
};

beforeEach(async () => {
  packageDirectory = await mkdtemp(join(tmpdir(), 'jg-eslint-config-'));
});

afterEach(async () => {
  await rm(packageDirectory, { recursive: true, force: true });
});

describe('createEslintConfig', () => {
  test('reports floating promises and type-only value imports in TypeScript sources', async () => {
    await writeFixturePackage({
      'src/types.ts': 'export type IName = string;\n',
      'src/index.ts': [
        "import { IName } from './types.js';",
        '',
        'const load = async (): Promise<IName> => Promise.resolve("a");',
        '',
        'load();',
        '',
      ].join('\n'),
    });

    expect(await lintRuleIds(['src'])).toStrictEqual({
      'src/index.ts': [
        '@typescript-eslint/consistent-type-imports',
        '@typescript-eslint/no-floating-promises',
      ],
      'src/types.ts': [],
    });
  });

  test('lints configuration files with Node.js globals and never lints build output', async () => {
    await writeFixturePackage({
      'eslint.config.js': 'export default process.env.CI;\n',
      'dist/index.js': 'unusedVariable = 1;\n',
    });

    expect(await lintRuleIds(['.'])).toStrictEqual({ 'eslint.config.js': [] });
  });

  test('lints service worker scripts with service worker globals and no Node.js globals', async () => {
    await writeFixturePackage({
      'src/worker.sw.js': [
        "self.addEventListener('install', () => self.skipWaiting());",
        "importScripts('extra.js');",
        'caches.keys();',
        'process.exit(1);',
        '',
      ].join('\n'),
      'eslint.config.js': 'export default process.env.CI;\n',
    });

    expect(await lintRuleIds(['.'], ['src/**/*.sw.js'])).toStrictEqual({
      'eslint.config.js': [],
      // process
      'src/worker.sw.js': ['no-undef'],
    });
    expect(await lintRuleIds(['.'])).toStrictEqual({
      'eslint.config.js': [],
      // self twice, importScripts, and caches
      'src/worker.sw.js': ['no-undef', 'no-undef', 'no-undef', 'no-undef'],
    });
  });
});
