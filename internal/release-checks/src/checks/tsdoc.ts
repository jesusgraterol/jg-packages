import { findUndocumentedSymbols, type IApiReference } from '@jg-packages/api-reference';

/**
 * Check 6: every export of every TypeScript entry point has the TSDoc the package guidelines
 * require: a summary everywhere, and an `@example` on functions and classes.
 * @param reference The package's API reference.
 * @returns One problem per undocumented symbol.
 */
export const checkTsdoc = (reference: IApiReference): string[] =>
  findUndocumentedSymbols(reference).map(
    ({ subpath, name, kind, missing }) =>
      `${subpath} exports the ${kind} ${name} without ${missing.map((part) => (part === 'example' ? 'an @example' : 'a summary')).join(' or ')}`,
  );
