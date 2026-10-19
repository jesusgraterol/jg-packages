import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { writeApiMarkdown } from '@jg-packages/api-reference';

import { RELEASE_MANIFEST_FILE } from '../shared/constants.ts';
import { sha256 } from '../shared/release-files.ts';
import { runCommand } from '../shared/run-command.ts';
import { packAndCheck, runPack, type IVerifyDependencies } from './verify.ts';
import type { IRegistry } from '../checks/types.ts';

const FIXTURE_DIRECTORY = join(import.meta.dirname, '..', 'fixtures', 'sample-package');
const PACKAGE_NAME = 'jg-release-checks-sample';

let workDirectory: string;
let rootDirectory: string;
let packageDirectory: string;
let outputDirectory: string;

// a registry where the sample package isn't published yet
const EMPTY_REGISTRY: IRegistry = {
  getPackage: () => Promise.resolve(undefined),
  downloadTarball: () => Promise.reject(new Error('nothing is published')),
};

const dependencies: IVerifyDependencies = {
  registry: EMPTY_REGISTRY,
  runCommand,
  log: () => undefined,
};

// builds the fixture package the way a package's build script does, API.md included unless asked
const buildFixture = async ({ writesApiMarkdown = true } = {}): Promise<void> => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const result = await runCommand(process.execPath, [tsc, '-p', 'tsconfig.json'], {
    cwd: packageDirectory,
  });
  expect(result).toMatchObject({ exitCode: 0 });
  if (writesApiMarkdown) {
    await writeApiMarkdown(packageDirectory);
  }
};

// replaces text in one of the fixture copy's files
const editFile = async (path: string, search: string, replacement: string): Promise<void> => {
  const file = join(packageDirectory, path);
  const text = await readFile(file, 'utf8');
  expect(text).toContain(search);
  await writeFile(file, text.replace(search, replacement));
};

// packs and checks the copied workspace, returning the sample package's problems
const checkProblems = async (): Promise<string[]> => {
  const { problems } = await packAndCheck(rootDirectory, outputDirectory, dependencies);
  return problems.get(PACKAGE_NAME) ?? [];
};

beforeEach(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'jg-release-verify-test-'));
  rootDirectory = join(workDirectory, 'repo');
  packageDirectory = join(rootDirectory, 'packages', 'sample');
  outputDirectory = join(workDirectory, 'release');
  await mkdir(outputDirectory, { recursive: true });
  await cp(FIXTURE_DIRECTORY, packageDirectory, { recursive: true });
  await writeFile(
    join(rootDirectory, 'pnpm-workspace.yaml'),
    'packages:\n  - internal/*\n  - packages/*\n',
  );
  await buildFixture();
}, 60_000);

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

describe('packAndCheck', { tags: ['full'] }, () => {
  test('passes a well-formed package and lists its tarball with its checksum', async () => {
    const { entries, problems } = await packAndCheck(rootDirectory, outputDirectory, dependencies);

    expect(problems.get(PACKAGE_NAME)).toStrictEqual([]);
    expect(entries).toStrictEqual([
      {
        name: PACKAGE_NAME,
        version: '1.0.0',
        file: `${PACKAGE_NAME}-1.0.0.tgz`,
        sha256: sha256(await readFile(join(outputDirectory, `${PACKAGE_NAME}-1.0.0.tgz`))),
      },
    ]);
  }, 120_000);

  test('fails an export without its @example, a changelog without the version, and a README without a section', async () => {
    await editFile(
      'src/index.ts',
      " * @example\n * import { greet } from 'jg-release-checks-sample';\n *\n * greet('Ada'); // => 'Hello, Ada!'\n",
      '',
    );
    await editFile('CHANGELOG.md', '## 1.0.0', '## 0.9.0');
    await editFile('README.md', '## Usage', '## Examples');
    await buildFixture();

    expect(await checkProblems()).toStrictEqual([
      'CHANGELOG.md has no `## 1.0.0` section',
      'README.md needs the sections `## Install`, `## Usage`, `## Documentation`, `## License` once each, in that order',
      '. exports the function greet without an @example',
    ]);
  }, 120_000);

  test('fails an API.md that the TSDoc has moved past', async () => {
    await editFile('src/index.ts', ' * Builds a greeting.', ' * Builds a friendly greeting.');
    await buildFixture({ writesApiMarkdown: false });

    expect(await checkProblems()).toStrictEqual([
      'API.md differs from a fresh render of the TSDoc; build the package again',
    ]);
  }, 120_000);

  test('fails a test file in the build output and a missing exports target', async () => {
    await writeFile(join(packageDirectory, 'dist', 'index.test-unit.js'), 'export {};\n');
    await rm(join(packageDirectory, 'dist', 'index.d.ts'));

    const problems = await checkProblems();

    expect(problems).toContain('ships a test or build-info file: dist/index.test-unit.js');
    expect(problems).toContain('is missing an `exports` or `bin` target: ./dist/index.d.ts');
  }, 120_000);

  test('fails a command that exits with an error on --help', async () => {
    await editFile(
      'package.json',
      '"main": "./dist/index.js",',
      '"bin": {\n    "sample": "./dist/cli.js"\n  },\n  "main": "./dist/index.js",',
    );
    await writeFile(
      join(packageDirectory, 'dist', 'cli.js'),
      "#!/usr/bin/env node\nconsole.error('no help here');\nprocess.exitCode = 3;\n",
    );

    expect(await checkProblems()).toStrictEqual(['`sample --help` exits with 3: no help here']);
  }, 120_000);

  test('fails a workspace whose tests pnpm check would skip, even a private one', async () => {
    await mkdir(join(rootDirectory, 'internal', 'tool'), { recursive: true });
    await writeFile(
      join(rootDirectory, 'internal', 'tool', 'package.json'),
      JSON.stringify({
        name: '@sample/tool',
        private: true,
        scripts: { 'test:unit': 'vitest run' },
      }),
    );

    const { workspaceProblems } = await packAndCheck(rootDirectory, outputDirectory, dependencies);

    expect(workspaceProblems).toStrictEqual([
      '@sample/tool has test:unit but no test:coverage, so pnpm check never runs its tests',
    ]);
    expect(await runPack(rootDirectory, join(workDirectory, 'blocked'), dependencies)).toBe(1);
  }, 120_000);

  test('fails when no package is publishable', async () => {
    await editFile('package.json', '"license": "MIT",', '"license": "MIT",\n  "private": true,');

    await expect(packAndCheck(rootDirectory, outputDirectory, dependencies)).rejects.toThrow(
      'No publishable packages were found under packages/.',
    );
  });
});

describe('runPack', { tags: ['full'] }, () => {
  test('writes the release manifest next to the tarballs when every check passes', async () => {
    const releaseDirectory = join(workDirectory, 'packed');

    expect(await runPack(rootDirectory, releaseDirectory, dependencies)).toBe(0);
    expect((await readdir(releaseDirectory)).sort()).toStrictEqual([
      `${PACKAGE_NAME}-1.0.0.tgz`,
      RELEASE_MANIFEST_FILE,
    ]);
  }, 120_000);

  test('refuses an output directory that already holds files', async () => {
    await writeFile(join(outputDirectory, 'stale.tgz'), '');

    await expect(runPack(rootDirectory, outputDirectory, dependencies)).rejects.toThrow(
      "The output directory isn't empty; remove it first",
    );
  });
});
