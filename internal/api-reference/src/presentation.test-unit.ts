import { describe, expect, test } from 'vitest';

import {
  formatSignature,
  groupSymbols,
  parseExample,
  splitThrowsItem,
  toEntryPointAnchor,
  toImportSpecifier,
  toSymbolAnchor,
} from './presentation.ts';
import type { IApiEntryPoint, IApiSymbol } from './types.ts';

/**
 * Builds a symbol.
 * @param name The name.
 * @param kind The kind.
 * @returns The symbol.
 */
const symbol = (name: string, kind: IApiSymbol['kind']): IApiSymbol => ({
  name,
  kind,
  summary: '',
  examples: [],
  deprecated: undefined,
  signatures: [],
  type: undefined,
  members: [],
});

describe('anchors and specifiers', () => {
  test('prefix symbols of other entry points with their subpath', () => {
    expect(toSymbolAnchor('.', 'readFile')).toBe('api-readFile');
    expect(toSymbolAnchor('./sync', 'readFile')).toBe('api-sync-readFile');
    expect(toSymbolAnchor('./build', 'ERRORS')).toBe('api-build-ERRORS');
    expect(toImportSpecifier('jg-fs', '.')).toBe('jg-fs');
    expect(toImportSpecifier('jg-fs', './sync')).toBe('jg-fs/sync');
    expect(toEntryPointAnchor('.')).toBe('api-entry-main');
    expect(toEntryPointAnchor('./sync')).toBe('api-entry-sync');
  });
});

describe('groupSymbols', () => {
  test('groups by kind in the reference order, sorted by name, and drops empty groups', () => {
    const entryPoint: IApiEntryPoint = {
      subpath: './sync',
      symbols: [
        symbol('IOptions', 'type'),
        symbol('writeFile', 'function'),
        symbol('ERRORS', 'constant'),
        symbol('readFile', 'function'),
      ],
    };

    expect(
      groupSymbols(entryPoint).map(({ heading, id, symbols }) => ({
        heading,
        id,
        names: symbols.map(({ name }) => name),
      })),
    ).toStrictEqual([
      { heading: 'Functions', id: 'api-sync-functions', names: ['readFile', 'writeFile'] },
      { heading: 'Constants', id: 'api-sync-constants', names: ['ERRORS'] },
      { heading: 'Types', id: 'api-sync-types', names: ['IOptions'] },
    ]);
  });
});

describe('formatSignature', () => {
  test('keeps a short signature on one line', () => {
    expect(formatSignature('isEqual(a: unknown, b: unknown): boolean')).toBe(
      'isEqual(a: unknown, b: unknown): boolean',
    );
  });

  test('puts each parameter of a long signature on its own line, splitting at top-level commas', () => {
    expect(
      formatSignature(
        'request<T = unknown>(url: string | URL, options?: IRequestOptions<T, Record<string, number>>, callback?: (a: number, b: string) => void): Promise<IRequestResult<T>>',
      ),
    ).toBe(
      [
        'request<T = unknown>(',
        '  url: string | URL,',
        '  options?: IRequestOptions<T, Record<string, number>>,',
        '  callback?: (a: number, b: string) => void,',
        '): Promise<IRequestResult<T>>',
      ].join('\n'),
    );
  });
});

describe('parseExample', () => {
  test('reads a fenced example and defaults to TypeScript', () => {
    expect(parseExample('```ts\nconst a = 1;\nconst b = 2;\n```')).toStrictEqual({
      lang: 'ts',
      code: 'const a = 1;\nconst b = 2;',
    });
    expect(parseExample('```\nrun();\n```')).toStrictEqual({ lang: 'ts', code: 'run();' });
    expect(parseExample('run();')).toStrictEqual({ lang: 'ts', code: 'run();' });
  });
});

describe('splitThrowsItem', () => {
  test('separates a code from its message', () => {
    expect(splitThrowsItem('NOT_A_FILE: The path is not a file.')).toStrictEqual({
      code: 'NOT_A_FILE',
      message: 'The path is not a file.',
    });
    expect(splitThrowsItem('1,000,001: Failed.')).toStrictEqual({
      code: '1,000,001',
      message: 'Failed.',
    });
    expect(splitThrowsItem('The value is invalid.')).toStrictEqual({
      code: undefined,
      message: 'The value is invalid.',
    });
  });
});
