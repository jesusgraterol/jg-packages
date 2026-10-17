import { extractApiReference, findUndocumentedSymbols } from '@jg-packages/api-reference';

/**
 * Check 6: every export of every TypeScript entry point has the TSDoc the package guidelines
 * require: a summary everywhere, and an `@example` on functions and classes.
 * @param packageDirectory The package directory.
 * @returns A promise that resolves to one problem per undocumented symbol.
 */
export const checkTsdoc = async (packageDirectory: string): Promise<string[]> =>
  findUndocumentedSymbols(await extractApiReference(packageDirectory)).map(
    ({ subpath, name, kind, missing }) =>
      `${subpath} exports the ${kind} ${name} without ${missing.map((part) => (part === 'example' ? 'an @example' : 'a summary')).join(' or ')}`,
  );
