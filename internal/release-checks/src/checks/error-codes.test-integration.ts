import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runCommand } from '../shared/run-command.ts';
import { packPackage } from '../verify/verify.ts';
import { findPublishablePackages } from '../workspace/workspace.ts';
import { installConsumerProject } from './consumer-project.ts';
import { checkErrorCodes } from './error-codes.ts';

const FIXTURE_DIRECTORY = join(import.meta.dirname, '..', 'fixtures', 'sample-package');
const PACKAGE_NAME = 'jg-release-checks-sample';

let workDirectory: string;
let rootDirectory: string;
let packageDirectory: string;

// gives the fixture copy two error codes
const addErrors = async (): Promise<void> => {
  const index = join(packageDirectory, 'src', 'index.ts');
  await writeFile(
    index,
    `${await readFile(index, 'utf8')}
// the codes for every error the package throws
export const ERRORS = {
  GREETING_TOO_LONG: 'GREETING_TOO_LONG',
  NAME_MISSING: 'NAME_MISSING',
} as const;
`,
  );
};

/**
 * Builds and packs the fixture copy, installs it, writes its test file, which check 9 reads from
 * the source and never ships, and runs check 9.
 * @param test The test file's text, or undefined for none.
 * @param testFileName The test file's name, which sets its category.
 * @returns A promise that resolves to the fixture's problems.
 */
const checkFixtureCodes = async (
  test?: string,
  testFileName = 'index.test-unit.ts',
): Promise<string[]> => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const build = await runCommand(process.execPath, [tsc, '-p', 'tsconfig.json'], {
    cwd: packageDirectory,
  });
  expect(build).toMatchObject({ exitCode: 0 });
  if (test !== undefined) {
    await writeFile(join(packageDirectory, 'src', testFileName), test);
  }
  const output = join(workDirectory, 'tarballs');
  await mkdir(output, { recursive: true });
  const packages = await Promise.all(
    (await findPublishablePackages(rootDirectory)).map((workspacePackage) =>
      packPackage(workspacePackage, output, runCommand),
    ),
  );
  const consumer = await installConsumerProject(packages, runCommand);
  try {
    return (await checkErrorCodes(packages, runCommand, consumer)).get(PACKAGE_NAME) ?? [];
  } finally {
    await consumer.remove();
  }
};

beforeEach(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'jg-release-codes-test-'));
  rootDirectory = join(workDirectory, 'repo');
  packageDirectory = join(rootDirectory, 'packages', 'sample');
  await cp(FIXTURE_DIRECTORY, packageDirectory, { recursive: true });
});

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

describe('checkErrorCodes', { tags: ['full'] }, () => {
  test('names each code no test asserts, reading ERRORS from the installed tarball', async () => {
    await addErrors();

    const problems = await checkFixtureCodes(
      [
        "import { expectToThrowCode } from 'jg-exception/testing';",
        "import { ERRORS } from './index.js';",
        '',
        'expectToThrowCode(() => undefined, ERRORS.GREETING_TOO_LONG);',
        '// expectToThrowCode(() => undefined, ERRORS.NAME_MISSING);',
        'const unused = ERRORS.NAME_MISSING;',
        '',
      ].join('\n'),
    );

    expect(problems).toStrictEqual([
      "ERRORS.NAME_MISSING ('NAME_MISSING') is never asserted in a test",
    ]);
  }, 180_000);

  test('passes when every code is asserted', async () => {
    await addErrors();

    const problems = await checkFixtureCodes(
      [
        "expect(error).toMatchObject({ code: 'GREETING_TOO_LONG' });",
        'await expect(promise).rejects.toMatchObject({ code: ERRORS.NAME_MISSING });',
        '',
      ].join('\n'),
    );

    expect(problems).toStrictEqual([]);
  }, 180_000);

  test('reads the assertions in end-to-end tests too', async () => {
    await addErrors();

    const problems = await checkFixtureCodes(
      [
        "await expectToRejectCode(promise, ERRORS.GREETING_TOO_LONG, 'Greeting');",
        "expect(error).toMatchObject({ code: 'NAME_MISSING' });",
        '',
      ].join('\n'),
      'index.test-e2e.ts',
    );

    expect(problems).toStrictEqual([]);
  }, 180_000);

  test('skips a package without ERRORS', async () => {
    expect(await checkFixtureCodes()).toStrictEqual([]);
  }, 180_000);
});
