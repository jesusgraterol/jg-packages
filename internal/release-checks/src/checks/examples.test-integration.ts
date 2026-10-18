import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { runCommand } from '../shared/run-command.ts';
import { findPublishablePackages } from '../workspace/workspace.ts';
import { packPackage } from '../verify/verify.ts';
import { installConsumerProject } from './consumer-project.ts';
import { checkExamples } from './examples.ts';

const FIXTURE_DIRECTORY = join(import.meta.dirname, '..', 'fixtures', 'sample-package');
const PACKAGE_NAME = 'jg-release-checks-sample';

let workDirectory: string;
let rootDirectory: string;
let packageDirectory: string;

// replaces text in a file of the fixture copy, its source by default
const editSource = async (
  search: string,
  replacement: string,
  path: string = join('src', 'index.ts'),
): Promise<void> => {
  const file = join(packageDirectory, path);
  const text = await readFile(file, 'utf8');
  expect(text).toContain(search);
  await writeFile(file, text.replace(search, replacement));
};

// builds and packs the fixture copy, installs it, and runs check 8 with its examples runnable
const checkFixtureExamples = async (): Promise<string[]> => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');
  const build = await runCommand(process.execPath, [tsc, '-p', 'tsconfig.json'], {
    cwd: packageDirectory,
  });
  expect(build).toMatchObject({ exitCode: 0 });
  const output = join(workDirectory, 'tarballs');
  await mkdir(output, { recursive: true });
  const packages = await Promise.all(
    (await findPublishablePackages(rootDirectory)).map((workspacePackage) =>
      packPackage(workspacePackage, output, runCommand),
    ),
  );
  const consumer = await installConsumerProject(packages, runCommand);
  try {
    expect(consumer.installProblem).toBeUndefined();
    const problems = await checkExamples(packages, runCommand, consumer, new Set([PACKAGE_NAME]));
    return problems.get(PACKAGE_NAME) ?? [];
  } finally {
    await consumer.remove();
  }
};

beforeEach(async () => {
  workDirectory = await mkdtemp(join(tmpdir(), 'jg-release-examples-test-'));
  rootDirectory = join(workDirectory, 'repo');
  packageDirectory = join(rootDirectory, 'packages', 'sample');
  await cp(FIXTURE_DIRECTORY, packageDirectory, { recursive: true });
});

afterEach(async () => {
  await rm(workDirectory, { recursive: true, force: true });
});

describe('checkExamples', () => {
  test('typechecks inputs examples.d.ts declares, which a runnable example still lacks', async () => {
    await editSource(
      " * greet('Ada'); // => 'Hello, Ada!'\n",
      " * greet('Ada'); // => 'Hello, Ada!'\n * @example\n * import { greet } from 'jg-release-checks-sample';\n *\n * greet(visitor);\n",
    );
    await writeFile(join(packageDirectory, 'examples.d.ts'), 'declare const visitor: string;\n');

    expect(await checkFixtureExamples()).toStrictEqual([
      expect.stringMatching(
        /^the example of greet fails: .*ReferenceError: visitor is not defined/,
      ),
    ]);
  }, 180_000);

  test('passes the fixture as it is', async () => {
    expect(await checkFixtureExamples()).toStrictEqual([]);
  }, 180_000);

  test('fails a stated result that is wrong, naming the symbol', async () => {
    await editSource("// => 'Hello, Ada!'", "// => 'Hi, Ada!'");

    expect(await checkFixtureExamples()).toStrictEqual([
      expect.stringMatching(/^the example of greet fails: .*AssertionError/),
    ]);
  }, 180_000);

  test("fails an example that doesn't typecheck, naming the symbol and the line", async () => {
    await editSource("greet('Ada');", 'greet(visitor);');

    expect(await checkFixtureExamples()).toStrictEqual([
      "the example of greet doesn't typecheck: line 3, TS2304: Cannot find name 'visitor'.",
    ]);
  }, 180_000);

  test("fails a recipe block that doesn't typecheck, naming the recipe and the block", async () => {
    await editSource('visitor.name ?? DEFAULT_NAME', 'visitor.nickname', 'RECIPES.md');

    expect(await checkFixtureExamples()).toStrictEqual([
      expect.stringMatching(
        /^the recipe "Greeting a visitor", block 1, doesn't typecheck: line 5, TS2339: Property 'nickname' does not exist/,
      ),
    ]);
  }, 180_000);

  test('typechecks a ```tsx block too, with its own file name', async () => {
    const recipes = join(packageDirectory, 'RECIPES.md');
    await writeFile(
      recipes,
      `${await readFile(recipes, 'utf8')}\n## Greeting in a component\n\n\`\`\`tsx\nexport const count: number = 'one';\n\`\`\`\n`,
    );

    expect(await checkFixtureExamples()).toStrictEqual([
      expect.stringMatching(
        /^the recipe "Greeting in a component", block 1, doesn't typecheck: line 1, TS2322: Type 'string' is not assignable to type 'number'/,
      ),
    ]);
  }, 180_000);

  test('fails a result stated inside a block', async () => {
    await editSource(
      " * greet('Ada'); // => 'Hello, Ada!'\n",
      " * if (greet) {\n *   greet('Ada'); // => 'Hello, Ada!'\n * }\n",
    );

    expect(await checkFixtureExamples()).toStrictEqual([
      "the example of greet states a result on line 4, inside a block, where it can't be checked",
    ]);
  }, 180_000);
});
