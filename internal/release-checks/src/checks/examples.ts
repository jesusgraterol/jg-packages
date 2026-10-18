import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import {
  extractApiReference,
  type IApiReference,
  type IApiSignature,
} from '@jg-packages/api-reference';
import ts from 'typescript';

import type { IRunCommand } from '../shared/types.ts';
import { classifyExports } from './astro-fixture.ts';
import type { IConsumerProject } from './consumer-project.ts';
import type { IPackedPackage } from './types.ts';

// the packages whose examples also run, because nothing in them does I/O
export const RUNNABLE_EXAMPLE_PACKAGES: ReadonlySet<string> = new Set([
  'jg-exception',
  'jg-api-response',
  'jg-utilities',
  'jg-bignumber',
]);

// the unshipped file where a package declares what its examples use but don't define
const EXAMPLES_DECLARATIONS_FILE = 'examples.d.ts';

// the file a package's recipes ship in
export const RECIPES_FILE = 'RECIPES.md';

// a comment that states the result of the line it ends, such as `// => 'hi-there'`
const RESULT_COMMENT = /^\/\/\s*=>\s*(.+?)\s*$/;

// the locale and time zone examples run in, so formatted dates and numbers read the same anywhere
const EXAMPLE_ENVIRONMENT = { LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC' };

// the repository's shared compiler options, which the examples are checked with
const BASE_TSCONFIG = join(import.meta.dirname, '..', '..', '..', 'tsconfig', 'base.json');

const require = createRequire(import.meta.url);

// one example, with the symbol it documents
export type IPackageExample = {
  // the symbol, such as `copyText`, `Exception#toJSON`, or `readJsonFile in ./sync`
  label: string;
  code: string;
};

/**
 * Reads the code of an example: the content of its fenced block, or the example as it is.
 * @param example The example as Markdown.
 * @returns The code.
 */
export const readExampleCode = (example: string): string => {
  const fenced = /^```[\w-]*\n([\s\S]*?)\n?```$/.exec(example.trim());
  return (fenced?.[1] ?? example).trim();
};

/**
 * Lists a package's examples once each. TypeDoc repeats a function's examples on the symbol and on
 * its signature, and an entry point can repeat another's symbol, so identical ones count once.
 * @param reference The package's API reference.
 * @returns The examples, in the reference's order.
 */
export const collectExamples = (reference: IApiReference): IPackageExample[] => {
  const examples = new Map<string, IPackageExample>();
  const add = (label: string, texts: string[]): void => {
    for (const text of texts) {
      const code = readExampleCode(text);
      const key = `${label}\n${code}`;
      if (!examples.has(key)) {
        examples.set(key, { label, code });
      }
    }
  };
  const fromSignatures = (signatures: IApiSignature[]): string[] =>
    signatures.flatMap(({ examples: texts }) => texts);
  for (const { subpath, symbols } of reference.entryPoints) {
    for (const symbol of symbols) {
      const label = subpath === '.' ? symbol.name : `${symbol.name} in ${subpath}`;
      add(label, [...symbol.examples, ...fromSignatures(symbol.signatures)]);
      for (const member of symbol.members) {
        add(`${label}#${member.name}`, fromSignatures(member.signatures));
      }
    }
  }
  return [...examples.values()];
};

// a ```ts or ```tsx block of a recipe: its code, and whether it holds JSX
export type IRecipeCode = { code: string; isJsx: boolean };

// a recipe in RECIPES.md: its heading, and its ```ts and ```tsx blocks in order
export type IRecipe = { heading: string; blocks: IRecipeCode[] };

// one block of a recipe, with the recipe's heading and the block's position in it, from 1
export type IRecipeBlock = IRecipeCode & { recipe: string; position: number };

/**
 * Reads the recipes of a RECIPES.md: each `## ` section, with its ```ts and ```tsx blocks, the
 * latter for a package with a React peer, whose recipes render components. Headings inside a
 * code block don't start a recipe, and blocks before the first recipe belong to none.
 * @param markdown The file's text.
 * @returns The recipes, in order.
 */
export const readRecipes = (markdown: string): IRecipe[] => {
  const recipes: IRecipe[] = [];
  let fence: { language: string; lines: string[] } | undefined;
  for (const line of markdown.split('\n')) {
    if (fence !== undefined) {
      if (/^```\s*$/.test(line)) {
        if (fence.language === 'ts' || fence.language === 'tsx') {
          recipes
            .at(-1)
            ?.blocks.push({ code: fence.lines.join('\n'), isJsx: fence.language === 'tsx' });
        }
        fence = undefined;
      } else {
        fence.lines.push(line);
      }
    } else if (line.startsWith('```')) {
      fence = { language: line.slice(3).trim(), lines: [] };
    } else if (line.startsWith('## ')) {
      recipes.push({ heading: line.slice(3).trim(), blocks: [] });
    }
  }
  return recipes;
};

/**
 * Lists every ```ts and ```tsx block of a RECIPES.md, with the recipe it belongs to and its
 * position there.
 * @param markdown The file's text.
 * @returns The blocks, in order.
 */
export const collectRecipeBlocks = (markdown: string): IRecipeBlock[] =>
  readRecipes(markdown).flatMap(({ heading, blocks }) =>
    blocks.map((block, index) => ({ ...block, recipe: heading, position: index + 1 })),
  );

// an example rewritten so its stated results are asserted, or why that's impossible
export type IRunnableExample = { code: string; problems: string[] };

/**
 * Turns every top-level `expression; // => result` line into `assert.deepStrictEqual(expression,
 * result)`, so running the example checks what it states. A result comment anywhere else can't be
 * checked, so it's a problem.
 * @param code The example's code.
 * @returns The code to run, and its problems.
 */
export const toRunnableExample = (code: string): IRunnableExample => {
  const source = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];
  const replacements: { start: number; end: number; text: string }[] = [];
  const handled = new Set<number>();
  for (const statement of source.statements) {
    for (const range of ts.getTrailingCommentRanges(code, statement.end) ?? []) {
      const result = RESULT_COMMENT.exec(code.slice(range.pos, range.end))?.[1];
      if (result === undefined) {
        continue;
      }
      handled.add(range.pos);
      if (!ts.isExpressionStatement(statement)) {
        problems.push(
          `states a result after a statement that isn't an expression: ${statement.getText(source)}`,
        );
        continue;
      }
      replacements.push({
        start: statement.getStart(source),
        end: range.end,
        text: `assert.deepStrictEqual(${statement.expression.getText(source)}, ${result});`,
      });
    }
  }
  // a result comment the loop above didn't reach sits inside a block, where nothing checks it
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    code,
  );
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia &&
      RESULT_COMMENT.test(scanner.getTokenText()) &&
      !handled.has(scanner.getTokenStart())
    ) {
      const line = source.getLineAndCharacterOfPosition(scanner.getTokenStart()).line + 1;
      problems.push(`states a result on line ${line}, inside a block, where it can't be checked`);
    }
  }
  const runnable = replacements
    .sort((first, second) => second.start - first.start)
    .reduce(
      (text, { start, end, text: replacement }) =>
        text.slice(0, start) + replacement + text.slice(end),
      code,
    );
  return { code: `import assert from 'node:assert/strict';\n${runnable}\n`, problems };
};

/**
 * Builds the compiler options the examples are typechecked with: the repository's strict settings,
 * without the unused-name rules examples don't need, with Node.js and DOM globals, and with React's
 * JSX transform for ```tsx recipes.
 * @returns A promise that resolves to the tsconfig.json content.
 */
const buildExamplesTsconfig = async (): Promise<string> => {
  const base = JSON.parse(await readFile(BASE_TSCONFIG, 'utf8')) as {
    compilerOptions: Record<string, unknown>;
  };
  return JSON.stringify({
    compilerOptions: {
      ...base.compilerOptions,
      noUnusedLocals: false,
      noUnusedParameters: false,
      noEmit: true,
      lib: ['es2023', 'dom', 'dom.iterable'],
      jsx: 'react-jsx',
      types: ['node'],
      typeRoots: [dirname(dirname(require.resolve('@types/node/package.json')))],
    },
    include: ['*.ts', '*.tsx'],
  });
};

/**
 * Keeps the first lines of a failed command's output.
 * @param output The output.
 * @returns At most five non-empty lines.
 */
const firstLines = (output: string): string =>
  output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .slice(0, 5)
    .join(' ');

/**
 * Keeps the error a failed example threw: from its name, such as `AssertionError`, up to its stack,
 * so the message shows what failed instead of where Node.js reported it.
 * @param stderr The example's error output.
 * @returns The error's lines, joined.
 */
export const readThrownError = (stderr: string): string => {
  const lines = stderr.split('\n').map((line) => line.trim());
  const start = lines.findIndex((line) => /^[A-Z]\w*(?:Error|Exception)\b/.test(line));
  const error = lines.slice(Math.max(start, 0));
  const stack = error.findIndex((line) => line.startsWith('at '));
  return firstLines(error.slice(0, stack === -1 ? undefined : stack).join('\n'));
};

/**
 * Checks one package's examples and recipes in the consumer project: each example and each recipe
 * block typechecks, and, for a runnable package, each example runs with its stated results
 * asserted. Recipes show app code that does I/O, so they're only typechecked.
 * @param packed The package.
 * @param runCommand Runs a command.
 * @param consumerDirectory The consumer project.
 * @param isRunnable Whether its examples run.
 * @returns A promise that resolves to the problems.
 */
const checkPackageExamples = async (
  packed: IPackedPackage,
  runCommand: IRunCommand,
  consumerDirectory: string,
  isRunnable: boolean,
): Promise<string[]> => {
  const { directory: packageDirectory } = packed.workspacePackage;
  const examples = collectExamples(await extractApiReference(packageDirectory));
  const recipes = packed.files.get(RECIPES_FILE)?.toString('utf8');
  const recipeBlocks = recipes === undefined ? [] : collectRecipeBlocks(recipes);
  // check 6 reports a function or class without an example, and check 5 a missing recipe
  if (examples.length === 0 && recipeBlocks.length === 0) {
    return [];
  }
  const directory = join(consumerDirectory, 'examples', packed.packedManifest.name);
  await mkdir(join(directory, 'run'), { recursive: true });
  const fileName = (index: number): string => `${String(index).padStart(3, '0')}.ts`;
  await Promise.all(
    [
      ...examples.map(({ code }, index) => [fileName(index), code] as const),
      ...recipeBlocks.map(
        ({ code, isJsx }, index) => [`recipe-${fileName(index)}${isJsx ? 'x' : ''}`, code] as const,
      ),
    ].map(([file, code]) => writeFile(join(directory, file), `${code}\n\nexport {};\n`)),
  );
  const declarations = join(packageDirectory, EXAMPLES_DECLARATIONS_FILE);
  const hasDeclarations = await access(declarations).then(
    () => true,
    () => false,
  );
  if (hasDeclarations) {
    await copyFile(declarations, join(directory, EXAMPLES_DECLARATIONS_FILE));
  }
  await writeFile(join(directory, 'tsconfig.json'), await buildExamplesTsconfig());

  const problems: string[] = [];
  const failed = new Set<number>();
  const typecheck = await runCommand(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', '--pretty', 'false'],
    { cwd: directory },
  );
  for (const line of typecheck.stdout.split('\n')) {
    const diagnostic = /^(recipe-)?(\d{3})\.tsx?\((\d+),(\d+)\): error (TS\d+: .*)$/.exec(line);
    if (diagnostic === null) {
      continue;
    }
    const [, isRecipe, index, lineNumber, , message] = diagnostic;
    const example = isRecipe === undefined ? examples[Number(index)] : undefined;
    const block = isRecipe === undefined ? undefined : recipeBlocks[Number(index)];
    if (example !== undefined) {
      failed.add(Number(index));
      problems.push(
        `the example of ${example.label} doesn't typecheck: line ${lineNumber}, ${message}`,
      );
    } else if (block !== undefined) {
      problems.push(
        `the recipe "${block.recipe}", block ${block.position}, doesn't typecheck: line ${lineNumber}, ${message}`,
      );
    }
  }
  if (typecheck.exitCode !== 0 && problems.length === 0) {
    problems.push(
      `its examples and recipes don't typecheck: ${firstLines(typecheck.stdout || typecheck.stderr)}`,
    );
  }
  if (!isRunnable) {
    return problems;
  }
  for (const [index, { label, code }] of examples.entries()) {
    const runnable = toRunnableExample(code);
    problems.push(...runnable.problems.map((problem) => `the example of ${label} ${problem}`));
    if (failed.has(index) || runnable.problems.length > 0) {
      continue;
    }
    const file = join(directory, 'run', fileName(index));
    await writeFile(file, runnable.code);
    const run = await runCommand(process.execPath, [file], {
      cwd: consumerDirectory,
      env: { ...process.env, ...EXAMPLE_ENVIRONMENT },
    });
    if (run.exitCode !== 0) {
      problems.push(`the example of ${label} fails: ${readThrownError(run.stderr)}`);
    }
  }
  return problems;
};

/**
 * Check 8: every `@example`, and every ```ts block of the packed RECIPES.md, typechecks against
 * the installed tarballs, with the package's `examples.d.ts` when it has one, and the examples of
 * packages without I/O run, in en-US and UTC, with each `expression; // => result` line asserted.
 * Packages with Astro components are skipped, because their examples are Astro markup.
 * @param packages The packed packages.
 * @param runCommand Runs a command.
 * @param consumer The project the tarballs are installed in, which check 2 also uses.
 * @param runnablePackages The packages whose examples run.
 * @returns A promise that resolves to each package's problems, by name.
 */
export const checkExamples = async (
  packages: IPackedPackage[],
  runCommand: IRunCommand,
  consumer: IConsumerProject,
  runnablePackages: ReadonlySet<string> = RUNNABLE_EXAMPLE_PACKAGES,
): Promise<Map<string, string[]>> => {
  const problems = new Map<string, string[]>();
  // check 2 reports a failed install
  if (consumer.installProblem !== undefined) {
    return problems;
  }
  for (const packed of packages) {
    const { name, exports: exportsMap } = packed.packedManifest;
    if (classifyExports(name, exportsMap).components.length > 0) {
      continue;
    }
    problems.set(
      name,
      await checkPackageExamples(
        packed,
        runCommand,
        consumer.directory,
        runnablePackages.has(name),
      ),
    );
  }
  return problems;
};
