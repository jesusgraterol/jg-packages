import { describe, expect, test } from 'vitest';

import { findUndocumentedSymbols } from './find-undocumented-symbols.ts';
import type { IApiSignature, IApiSymbol } from './types.ts';

// builds a signature with only the documentation fields a test sets
const signature = (summary: string, examples: string[]): IApiSignature => ({
  text: 'fn(): void',
  summary,
  typeParameters: [],
  parameters: [],
  returnType: 'void',
  returns: '',
  throws: [],
  examples,
  deprecated: undefined,
});

// builds a symbol with only the documentation fields a test sets
const symbol = (
  overrides: Partial<IApiSymbol> & Pick<IApiSymbol, 'name' | 'kind'>,
): IApiSymbol => ({
  summary: '',
  examples: [],
  deprecated: undefined,
  signatures: [],
  type: undefined,
  members: [],
  ...overrides,
});

// checks one symbol in a one-entry-point reference
const check = (apiSymbol: IApiSymbol) =>
  findUndocumentedSymbols({
    packageName: 'sample',
    version: '1.0.0',
    entryPoints: [{ subpath: '.', symbols: [apiSymbol] }],
  });

describe('findUndocumentedSymbols', () => {
  test('accepts a function whose every overload has a summary and an example', () => {
    expect(
      check(
        symbol({
          name: 'fn',
          kind: 'function',
          signatures: [signature('Does it.', ['fn()']), signature('Does it too.', ['fn(1)'])],
        }),
      ),
    ).toStrictEqual([]);
  });

  test('reports an overload without an example even when another has one', () => {
    expect(
      check(
        symbol({
          name: 'fn',
          kind: 'function',
          signatures: [signature('Does it.', ['fn()']), signature('Does it too.', [])],
        }),
      ),
    ).toStrictEqual([{ subpath: '.', name: 'fn', kind: 'function', missing: ['example'] }]);
  });

  test('requires a summary and an example on classes', () => {
    expect(check(symbol({ name: 'Shape', kind: 'class', summary: 'A shape.' }))).toStrictEqual([
      { subpath: '.', name: 'Shape', kind: 'class', missing: ['example'] },
    ]);
  });

  test.each([['type'], ['interface'], ['constant'], ['variable'], ['enum']] as const)(
    'findUndocumentedSymbols(%s) -> requires only a summary',
    (kind) => {
      expect(check(symbol({ name: 'Thing', kind, summary: 'A thing.' }))).toStrictEqual([]);
      expect(check(symbol({ name: 'Thing', kind }))).toStrictEqual([
        { subpath: '.', name: 'Thing', kind, missing: ['summary'] },
      ]);
    },
  );
});
