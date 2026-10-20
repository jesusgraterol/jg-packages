import { Exception, isException } from '../exception/index.js';

import type { IErrorCatalog, IErrorCatalogEntry } from './types.js';

/**
 * Defines the errors a module throws in one place, by kind, so every throw site uses the same code,
 * message, and severity, and handlers recognize them by kind instead of repeating codes. `create`
 * builds the kind's Exception, and `is` tells whether an error is one of the catalog's, or of one
 * kind. Codes are compared, so `is` also recognizes an Exception from another installed copy of
 * the package.
 * @param entries Each kind's code, message, and severity.
 * @returns The catalog.
 * @example
 * import { defineErrorCatalog } from 'jg-exception';
 *
 * const githubErrors = defineErrorCatalog({
 *   unavailable: { code: 'GITHUB_UNAVAILABLE', message: 'GitHub is temporarily unavailable.' },
 *   accessDenied: { code: 'GITHUB_ACCESS_DENIED', message: 'GitHub access was denied.', severity: 'expected' },
 * });
 * const error = githubErrors.create('accessDenied', { data: { status: 403 } });
 * error.code; // => 'GITHUB_ACCESS_DENIED'
 * githubErrors.is(error, 'accessDenied'); // => true
 * githubErrors.is(error, 'unavailable'); // => false
 * githubErrors.is(new Error('other')); // => false
 */
export const defineErrorCatalog = <TKind extends string>(
  entries: Record<TKind, IErrorCatalogEntry>,
): IErrorCatalog<TKind> => {
  const codes = new Set(Object.values<IErrorCatalogEntry>(entries).map(({ code }) => code));
  return {
    create: (kind, { cause, data } = {}) => {
      const { code, message, severity } = entries[kind];
      return new Exception(message, { code, cause, data, severity });
    },
    is: (error, kind): error is Exception =>
      isException(error) &&
      (kind === undefined ? codes.has(error.code) : error.code === entries[kind].code),
  };
};
