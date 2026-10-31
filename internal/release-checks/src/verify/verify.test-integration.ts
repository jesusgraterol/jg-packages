import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

test('an interrupted gallery stops release orchestration before linting and registry work', async () => {
  // this minimal workspace exercises real packing and fixture preparation; external installation
  // reports a failure, then requested gallery shutdown must still stop the remaining checks
  const sourceRoot = resolve(import.meta.dirname, '../../../..');
  const uiManifest = JSON.parse(
    await readFile(join(sourceRoot, 'packages', 'jg-personal-astro-ui', 'package.json'), 'utf8'),
  ) as { devDependencies: Record<string, string> };
  await rm(packageDirectory, { recursive: true });
  await mkdir(join(packageDirectory, 'gallery', 'src', 'catalog'), { recursive: true });
  await writeFile(
    join(rootDirectory, 'pnpm-workspace.yaml'),
    await readFile(join(sourceRoot, 'pnpm-workspace.yaml')),
  );
  await writeFile(
    join(packageDirectory, 'package.json'),
    JSON.stringify({
      name: 'jg-personal-astro-ui',
      version: '0.1.0',
      exports: { './badge': './badge.astro' },
      files: ['badge.astro'],
      peerDependencies: { astro: '^7.4.0', tailwindcss: '^4.3.0' },
      devDependencies: Object.fromEntries(
        Object.entries(uiManifest.devDependencies).filter(
          ([, version]) => !version.startsWith('workspace:'),
        ),
      ),
    }),
  );
  await writeFile(join(packageDirectory, 'badge.astro'), '<span>Badge</span>');
  await writeFile(
    join(packageDirectory, 'gallery', 'src', 'catalog', 'index.ts'),
    "export const GALLERY_EXAMPLES = [{subpath:'badge'}];",
  );
  await writeFile(join(packageDirectory, 'playwright.config.ts'), 'export default {};');
  for (const name of ['jg-process', 'jg-playwright']) {
    const directory = join(rootDirectory, 'packages', name);
    await mkdir(directory);
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({ name, version: '0.1.0', exports: {} }),
    );
  }
  const script = `
    import {packAndCheck} from ${JSON.stringify(pathToFileURL(join(import.meta.dirname, 'verify.ts')).href)};
    import {runCommand} from ${JSON.stringify(pathToFileURL(resolve(import.meta.dirname, '../shared/run-command.ts')).href)};
    let registryCalls=0;
    let galleryCalls=0;
    const commands=[];
    const logs=[];
    try {
      await packAndCheck(${JSON.stringify(rootDirectory)},${JSON.stringify(outputDirectory)},{
        registry:{getPackage:async()=>{registryCalls++;return undefined},downloadTarball:async()=>{throw new Error('Unexpected registry download')}},
        runCommand:async(command,args,options)=>{
          commands.push(args[0]);
          return command==='pnpm'?runCommand(command,args,options):{exitCode:1,stdout:'',stderr:'installation unavailable in this test'};
        },
        log:message=>logs.push(message),
        runGalleryCommand:async(_command,_args,options)=>{
          galleryCalls++;
          return new Promise((_resolve,reject)=>{
            const timer=setTimeout(()=>reject(new Error('The test shutdown signal was not handled.')),5000);
            options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(options.signal.reason)},{once:true});
            process.kill(process.pid,'SIGTERM');
          });
        }
      });
      throw new Error('Gallery interruption was swallowed');
    }catch(error){
      process.stdout.write(JSON.stringify({code:error.code,message:error.message,registryCalls,galleryCalls,commands,continued:logs.some(message=>message.startsWith('Linting ')||message==='Comparing with the npm registry')}));
      process.exitCode=2;
    }
  `;
  const result = await runCommand(process.execPath, ['--input-type=module', '-e', script], {
    cwd: rootDirectory,
  });
  expect(result.stderr).toBe('');
  expect(result.exitCode).toBe(2);
  expect(JSON.parse(result.stdout)).toStrictEqual({
    code: 'PROCESS_INTERRUPTED',
    message: 'The process was interrupted by SIGTERM.',
    registryCalls: 0,
    galleryCalls: 1,
    commands: ['pack', 'pack', 'pack', 'install'],
    continued: false,
  });
});

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

describe('packAndCheck', () => {
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

  test(
    'fails an export without its @example, a changelog without the version, and a README without a section',
    { tags: ['full'], timeout: 120_000 },
    async () => {
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
    },
  );

  test(
    'fails an API.md that the TSDoc has moved past',
    { tags: ['full'], timeout: 120_000 },
    async () => {
      await editFile('src/index.ts', ' * Builds a greeting.', ' * Builds a friendly greeting.');
      await buildFixture({ writesApiMarkdown: false });

      expect(await checkProblems()).toStrictEqual([
        'API.md differs from a fresh render of the TSDoc; build the package again',
      ]);
    },
  );

  test('fails a test file in the build output and a missing exports target', async () => {
    await writeFile(join(packageDirectory, 'dist', 'index.test-unit.js'), 'export {};\n');
    await rm(join(packageDirectory, 'dist', 'index.d.ts'));

    const problems = await checkProblems();

    expect(problems).toContain('ships a test or build-info file: dist/index.test-unit.js');
    expect(problems).toContain('is missing an `exports` or `bin` target: ./dist/index.d.ts');
  }, 120_000);

  test(
    'fails a command that exits with an error on --help',
    { tags: ['full'], timeout: 120_000 },
    async () => {
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
    },
  );

  test('fails a workspace whose tests pnpm check:full would skip, even a private one', async () => {
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
      '@sample/tool has test:unit but no test:coverage, so pnpm check:full never runs its tests',
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

describe('runPack', () => {
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
