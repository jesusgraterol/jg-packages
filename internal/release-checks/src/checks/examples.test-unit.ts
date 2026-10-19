import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import type { IApiReference, IApiSymbol } from '@jg-packages/api-reference';

import {
  buildExamplesTsconfig,
  collectExamples,
  collectRecipeBlocks,
  readExampleCode,
  readThrownError,
  toRunnableExample,
} from './examples.ts';

// builds a symbol with examples on itself, its signature, and a member
const symbol = (name: string, examples: string[], memberExamples: string[] = []): IApiSymbol => ({
  name,
  kind: 'function',
  summary: '',
  examples,
  deprecated: undefined,
  signatures: [
    {
      text: `${name}()`,
      summary: '',
      typeParameters: [],
      parameters: [],
      returnType: 'void',
      returns: '',
      throws: [],
      examples,
      deprecated: undefined,
    },
  ],
  type: undefined,
  members:
    memberExamples.length === 0
      ? []
      : [
          {
            name: 'toJSON',
            kind: 'method',
            summary: '',
            type: undefined,
            signatures: [
              {
                text: 'toJSON()',
                summary: '',
                typeParameters: [],
                parameters: [],
                returnType: 'object',
                returns: '',
                throws: [],
                examples: memberExamples,
                deprecated: undefined,
              },
            ],
          },
        ],
});

describe('readExampleCode', () => {
  test('reads the code of a fenced block, with or without a language', () => {
    expect(readExampleCode("```ts\nimport { a } from 'x';\n\na(); // => 1\n```")).toBe(
      "import { a } from 'x';\n\na(); // => 1",
    );
    expect(readExampleCode('```\na();\n```')).toBe('a();');
  });

  test('reads an example without a fence as it is', () => {
    expect(readExampleCode('  a();\n')).toBe('a();');
  });
});

describe('collectExamples', () => {
  test('lists each example once, named after its symbol, member, and entry point', () => {
    const reference: IApiReference = {
      packageName: 'jg-sample',
      version: '1.0.0',
      entryPoints: [
        {
          subpath: '.',
          symbols: [
            symbol('toSlug', ['```ts\ntoSlug();\n```']),
            symbol('Exception', [], ['```ts\nx.toJSON();\n```']),
          ],
        },
        { subpath: './sync', symbols: [symbol('toSlug', ['```ts\ntoSlug();\n```'])] },
      ],
    };

    expect(collectExamples(reference)).toStrictEqual([
      { label: 'toSlug', code: 'toSlug();' },
      { label: 'Exception#toJSON', code: 'x.toJSON();' },
      { label: 'toSlug in ./sync', code: 'toSlug();' },
    ]);
  });
});

describe('collectRecipeBlocks', () => {
  test("lists each recipe's ts and tsx blocks with the recipe and their position in it", () => {
    const markdown = [
      '# jg-sample recipes',
      '',
      'Patterns for apps that use jg-sample.',
      '',
      '```ts',
      "const beforeAnyRecipe = 'left out';",
      '```',
      '',
      '## Greeting a visitor',
      '',
      '```ts',
      "greet('Ada');",
      '```',
      '',
      '```bash',
      'echo left out',
      '```',
      '',
      '```ts',
      "greet('Grace');",
      "greet('Linus');",
      '```',
      '',
      '## Greeting in Markdown',
      '',
      '```ts',
      'const heading = `',
      '## Still the same block',
      '`;',
      '```',
      '',
      '## Greeting in a component',
      '',
      '```tsx',
      "export const Greeting = () => <p>{greet('Ada')}</p>;",
      '```',
    ].join('\n');

    expect(collectRecipeBlocks(markdown)).toStrictEqual([
      { recipe: 'Greeting a visitor', position: 1, code: "greet('Ada');", isJsx: false },
      {
        recipe: 'Greeting a visitor',
        position: 2,
        code: "greet('Grace');\ngreet('Linus');",
        isJsx: false,
      },
      {
        recipe: 'Greeting in Markdown',
        position: 1,
        code: 'const heading = `\n## Still the same block\n`;',
        isJsx: false,
      },
      {
        recipe: 'Greeting in a component',
        position: 1,
        code: "export const Greeting = () => <p>{greet('Ada')}</p>;",
        isJsx: true,
      },
    ]);
  });
});

describe('toRunnableExample', () => {
  test('asserts each top-level stated result, and imports assert', () => {
    const { code, problems } = toRunnableExample(
      [
        "import { toSlug } from 'jg-utilities';",
        '',
        "toSlug('Hi there'); // => 'hi-there'",
        'await Promise.resolve({ a: 1 }); //=> { a: 1 }',
        "toSlug('x'); // not a result",
      ].join('\n'),
    );

    expect(problems).toStrictEqual([]);
    expect(code).toBe(
      [
        "import assert from 'node:assert/strict';",
        "import { toSlug } from 'jg-utilities';",
        '',
        "assert.deepStrictEqual(toSlug('Hi there'), 'hi-there');",
        'assert.deepStrictEqual(await Promise.resolve({ a: 1 }), { a: 1 });',
        "toSlug('x'); // not a result",
        '',
      ].join('\n'),
    );
  });

  test('keeps a URL in a string from looking like a result', () => {
    expect(
      toRunnableExample("new URL('https://example.com/a').host; // => 'example.com'").code,
    ).toContain("assert.deepStrictEqual(new URL('https://example.com/a').host, 'example.com');");
  });

  test('reports a result stated after a declaration', () => {
    expect(toRunnableExample('const slug = toSlug("a"); // => \'a\'').problems).toStrictEqual([
      `states a result after a statement that isn't an expression: const slug = toSlug("a");`,
    ]);
  });

  test('reports a result inside a block, where nothing would check it', () => {
    expect(
      toRunnableExample(['if (ready) {', '  run(); // => true', '}'].join('\n')).problems,
    ).toStrictEqual(["states a result on line 2, inside a block, where it can't be checked"]);
  });
});

describe('readThrownError', () => {
  test("keeps the error from its name up to its stack, without Node.js's report", () => {
    const stderr = [
      'node:internal/modules/run_main:107',
      '    triggerUncaughtException(',
      '    ^',
      '',
      'AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:',
      '',
      "'hello-world' !== 'broken-value'",
      '',
      '    at file:///tmp/examples/run/003.ts:4:8',
      '    at ModuleJob.run (node:internal/modules/esm/module_job:271:25)',
    ].join('\n');

    expect(readThrownError(stderr)).toBe(
      "AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal: 'hello-world' !== 'broken-value'",
    );
  });

  test('keeps the first lines when no error name is found', () => {
    expect(readThrownError('Killed\n')).toBe('Killed');
  });
});

describe('buildExamplesTsconfig', () => {
  const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

  test('keeps standard decorators for a package that sets nothing', async () => {
    const { compilerOptions } = JSON.parse(
      await buildExamplesTsconfig(join(FIXTURES, 'sample-package')),
    ) as { compilerOptions: Record<string, unknown> };

    expect(compilerOptions).not.toHaveProperty('experimentalDecorators');
    expect(compilerOptions).toMatchObject({ strict: true, jsx: 'react-jsx', noEmit: true });
  });

  test("enables experimental decorators when the package's own tsconfig.json does", async () => {
    const { compilerOptions } = JSON.parse(
      await buildExamplesTsconfig(join(FIXTURES, 'experimental-decorators')),
    ) as { compilerOptions: Record<string, unknown> };

    expect(compilerOptions).toMatchObject({ experimentalDecorators: true, strict: true });
  });
});
