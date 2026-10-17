import type { IApiReference, IApiSymbol, IUndocumentedSymbol } from './types.ts';

/**
 * Lists what a symbol's documentation lacks: functions and classes need a summary and an
 * `@example`, with every overload of a function documented; types, interfaces, constants, and
 * variables need a summary.
 * @param symbol The symbol to check.
 * @returns The missing parts, empty when the symbol is documented.
 */
const getMissingDocumentation = (symbol: IApiSymbol): IUndocumentedSymbol['missing'] => {
  const missing: IUndocumentedSymbol['missing'] = [];
  if (symbol.kind === 'function') {
    if (symbol.signatures.some((signature) => signature.summary === '')) {
      missing.push('summary');
    }
    if (symbol.signatures.some((signature) => signature.examples.length === 0)) {
      missing.push('example');
    }
    return missing;
  }
  if (symbol.summary === '') {
    missing.push('summary');
  }
  if (symbol.kind === 'class' && symbol.examples.length === 0) {
    missing.push('example');
  }
  return missing;
};

/**
 * Lists every exported symbol whose TSDoc doesn't meet the package guidelines, so a release or the
 * website build can fail before an undocumented export ships.
 * @param reference The package's API reference.
 * @returns One entry per undocumented symbol and entry point, empty when everything is documented.
 * @example
 * const undocumented = findUndocumentedSymbols(await extractApiReference(packageDirectory));
 * if (undocumented.length > 0) {
 *   process.exitCode = 1;
 * }
 */
export const findUndocumentedSymbols = (reference: IApiReference): IUndocumentedSymbol[] =>
  reference.entryPoints.flatMap(({ subpath, symbols }) =>
    symbols.flatMap((symbol) => {
      const missing = getMissingDocumentation(symbol);
      return missing.length === 0
        ? []
        : [{ subpath, name: symbol.name, kind: symbol.kind, missing }];
    }),
  );
