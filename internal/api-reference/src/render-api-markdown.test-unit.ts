import { describe, expect, test } from 'vitest';

import { toSymbolAnchor } from './presentation.ts';
import { renderApiMarkdown } from './render-api-markdown.ts';
import type { IApiReference, IApiSignature, IApiSymbol } from './types.ts';

// builds a signature
const signature = (overrides: Partial<IApiSignature> = {}): IApiSignature => ({
  text: 'readFile(path: string): Promise<string>',
  summary: 'Reads a file.',
  typeParameters: [],
  parameters: [],
  returnType: 'Promise<string>',
  returns: 'The text.',
  throws: [],
  examples: [],
  deprecated: undefined,
  ...overrides,
});

// builds a symbol
const symbol = (overrides: Partial<IApiSymbol> & Pick<IApiSymbol, 'name'>): IApiSymbol => ({
  kind: 'function',
  summary: 'Reads a file.',
  examples: [],
  deprecated: undefined,
  signatures: [],
  type: undefined,
  members: [],
  ...overrides,
});

const READ_FILE = symbol({
  name: 'readFile',
  signatures: [
    signature({
      parameters: [
        {
          name: 'path',
          type: 'string',
          isOptional: false,
          isRest: false,
          defaultValue: undefined,
          description: "The file's path.",
        },
        {
          name: 'encoding',
          type: 'string',
          isOptional: true,
          isRest: false,
          defaultValue: "'utf-8'",
          description: 'The encoding.',
        },
        {
          name: 'parts',
          type: 'string[]',
          isOptional: false,
          isRest: true,
          defaultValue: undefined,
          description: '',
        },
      ],
      throws: ['NOT_A_FILE: The path is not a file.', 'The signal aborts.'],
      examples: ["```ts\nimport { readFile } from 'jg-sample';\n\nawait readFile('a.txt');\n```"],
    }),
  ],
});

const REFERENCE: IApiReference = {
  packageName: 'jg-sample',
  version: '1.2.0',
  entryPoints: [
    {
      subpath: '.',
      symbols: [
        READ_FILE,
        symbol({ name: 'MAX_SIZE', kind: 'constant', summary: 'The largest size.', type: '1024' }),
        symbol({
          name: 'oldRead',
          summary: 'Reads the old way.',
          deprecated: 'Use `readFile`.',
          signatures: [
            signature({
              text: 'oldRead(): void',
              returnType: 'void',
              summary: 'Reads the old way.',
            }),
          ],
        }),
        symbol({
          name: 'Reader',
          kind: 'class',
          summary: 'Reads files.',
          examples: ['```ts\nnew Reader();\n```', '```js\nnew Reader(1);\n```'],
          members: [
            { name: 'path', kind: 'property', summary: 'the path', type: 'string', signatures: [] },
            {
              name: 'read',
              kind: 'method',
              summary: '',
              type: undefined,
              signatures: [signature({ text: 'read(): string' })],
            },
          ],
        }),
        symbol({
          name: 'IOptions',
          kind: 'type',
          summary: 'The options.',
          type: '{ fence: "```" }',
        }),
      ],
    },
  ],
};

describe('renderApiMarkdown', () => {
  test('titles the reference, and lists each group with links to its symbols', () => {
    const markdown = renderApiMarkdown(REFERENCE);

    expect(markdown.startsWith('# <a id="api-reference"></a>jg-sample API reference\n\n')).toBe(
      true,
    );
    expect(markdown).toContain('Every export of `jg-sample@1.2.0`, 5 in all,');
    expect(markdown).toContain(
      '- Functions: [`oldRead`](#api-oldRead), [`readFile`](#api-readFile)\n- Classes: [`Reader`](#api-Reader)\n- Constants: [`MAX_SIZE`](#api-MAX_SIZE)\n- Types: [`IOptions`](#api-IOptions)',
    );
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });

  test("gives each heading the anchor the website's page uses", () => {
    const markdown = renderApiMarkdown(REFERENCE);

    expect(markdown).toContain('## <a id="api-functions"></a>Functions\n');
    expect(markdown).toContain(`### <a id="${toSymbolAnchor('.', 'readFile')}"></a>\`readFile\`\n`);
  });

  test('renders a function with its signature, parameters, return value, errors, and example', () => {
    const markdown = renderApiMarkdown(REFERENCE);

    expect(markdown).toContain(
      [
        '### <a id="api-readFile"></a>`readFile`',
        '',
        '*Function*',
        '',
        'Reads a file.',
        '',
        '```ts',
        'readFile(path: string): Promise<string>',
        '```',
        '',
        '**Parameters**',
        '',
        "- `path` `string`: The file's path.",
        "- `encoding?` `string`: The encoding. Defaults to `'utf-8'`.",
        '- `...parts` `string[]`: No description.',
        '',
        '**Returns** `Promise<string>`: The text.',
        '',
        '**Throws**',
        '',
        '- `NOT_A_FILE`: The path is not a file.',
        '- The signal aborts.',
        '',
        '**Example**',
        '',
        '```ts',
        "import { readFile } from 'jg-sample';",
        '',
        "await readFile('a.txt');",
        '```',
      ].join('\n'),
    );
  });

  test('marks a deprecated symbol, and leaves out a void return value', () => {
    const markdown = renderApiMarkdown(REFERENCE);

    expect(markdown).toContain(
      '*Function, deprecated*\n\nReads the old way.\n\n> **Deprecated.** Use `readFile`.',
    );
    expect(markdown).not.toContain('**Returns** `void`');
  });

  test("renders a constant's declaration, a type's, and a class's members and numbered examples", () => {
    const markdown = renderApiMarkdown(REFERENCE);

    expect(markdown).toContain('```ts\nconst MAX_SIZE: 1024\n```');
    // a fence one backtick longer than any run inside the code
    expect(markdown).toContain('````ts\n{ fence: "```" }\n````');
    expect(markdown).toContain(
      '**Members**\n\n- `path: string` (property): the path\n- `read(): string` (method)',
    );
    expect(markdown).toContain(
      '**Example 1**\n\n```ts\nnew Reader();\n```\n\n**Example 2**\n\n```js\nnew Reader(1);\n```',
    );
  });

  test('moves every heading down a level under a README', () => {
    const markdown = renderApiMarkdown(REFERENCE, { headingLevel: 2 });

    expect(markdown.startsWith('## <a id="api-reference"></a>jg-sample API reference')).toBe(true);
    expect(markdown).toContain('### <a id="api-functions"></a>Functions\n');
    expect(markdown).toContain('#### <a id="api-readFile"></a>`readFile`\n');
  });

  test('gives each entry point a heading when the package has several', () => {
    const markdown = renderApiMarkdown({
      ...REFERENCE,
      entryPoints: [
        ...REFERENCE.entryPoints,
        { subpath: './sync', symbols: [symbol({ name: 'readFile' })] },
      ],
    });

    expect(markdown).toContain('## <a id="api-entry-main"></a>`jg-sample`');
    expect(markdown).toContain('## <a id="api-entry-sync"></a>`jg-sample/sync`');
    expect(markdown).toContain('### <a id="api-sync-functions"></a>Functions in `jg-sample/sync`');
    expect(markdown).toContain('#### <a id="api-sync-readFile"></a>`readFile`');
  });
});
