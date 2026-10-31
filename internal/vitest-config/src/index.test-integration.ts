import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtemp, readFile, rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, test } from 'vitest';

const vitestRequire = createRequire(import.meta.url);
const VITEST = join(dirname(vitestRequire.resolve('vitest/package.json')), 'vitest.mjs');
const FACTORY = new URL('./index.ts', import.meta.url).href;

/**
 * Runs the actual runner against isolated files, including import and setup sentinels.
 * @returns Completion after the result is checked and the fixture is removed.
 */
const withSelection = async (
  suite: string | undefined,
  projects: string[],
  check: (root: string, result: SpawnSyncReturns<string>) => Promise<void>,
): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'jg-suite-'));
  try {
    await mkdir(join(root, 'src'));
    const setup = join(root, 'setup-ran');
    const imported = join(root, 'secondary-imported');
    await writeFile(
      join(root, 'vitest.config.ts'),
      `import { createVitestConfig } from ${JSON.stringify(FACTORY)};
const config = createVitestConfig({ categories: ['unit', 'integration'], globalSetup: './setup.ts', fullOnlyFiles: ['src/secondary.test-*.ts'] });
for (const project of config.test.projects) project.test.globals = true;
export default config;
`,
    );
    await writeFile(
      join(root, 'setup.ts'),
      `import { writeFileSync } from 'node:fs';
export default () => writeFileSync(${JSON.stringify(setup)}, 'ready');
`,
    );
    await writeFile(
      join(root, 'src/required.test-unit.ts'),
      "test('required', () => expect(4).toBe(4));\n",
    );
    for (const category of ['unit', 'integration'])
      await writeFile(
        join(root, `src/secondary.test-${category}.ts`),
        `import { writeFileSync } from 'node:fs';
if (process.env.JG_TEST_SUITE === 'essential') throw new Error('Secondary file imported in essential');
writeFileSync(${JSON.stringify(imported)}, 'loaded');
test('secondary ${category}', { tags: ['full'] }, () => expect(2).toBe(2));
`,
      );
    const env = { ...process.env };
    delete env['JG_TEST_SUITE'];
    if (suite !== undefined) env['JG_TEST_SUITE'] = suite;
    const result = spawnSync(
      process.execPath,
      [VITEST, 'run', '--reporter=json', '--outputFile=result.json', '--retry=0', ...projects],
      { cwd: root, env, encoding: 'utf8', timeout: 20_000, maxBuffer: 1_048_576 },
    );
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    await check(root, result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

test.each([
  [undefined, 3, true],
  ['full', 3, true],
  ['essential', 1, false],
] as const)(
  'native selection %s runs %d cases with secondary setup %s',
  async (suite, count, secondary) => {
    await withSelection(suite, [], async (root, result) => {
      expect(result.status, result.stderr.toString()).toBe(0);
      const report = JSON.parse(await readFile(join(root, 'result.json'), 'utf8')) as {
        numPassedTests: number;
        numFailedTests: number;
      };
      expect(report.numPassedTests).toBe(count);
      expect(report.numFailedTests).toBe(0);
      expect((await readdir(root)).includes('secondary-imported')).toBe(secondary);
      expect((await readdir(root)).includes('setup-ran')).toBe(secondary);
    });
  },
);

test('an unexpectedly empty required project fails without starting its excluded setup', async () => {
  await withSelection('essential', ['--project=integration'], async (root, result) => {
    expect(result.status).toBe(1);
    expect((await readdir(root)).includes('secondary-imported')).toBe(false);
    expect((await readdir(root)).includes('setup-ran')).toBe(false);
  });
});

test('invalid modes fail before imports or setup', async () => {
  await withSelection('quick', [], async (root, result) => {
    expect(result.status).toBe(1);
    expect(result.stderr.toString()).toContain(
      'JG_TEST_SUITE must be "essential" or "full" when set.',
    );
    expect((await readdir(root)).includes('secondary-imported')).toBe(false);
    expect((await readdir(root)).includes('setup-ran')).toBe(false);
  });
});
