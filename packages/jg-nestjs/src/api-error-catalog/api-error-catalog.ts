import { defineErrorCatalog } from 'jg-exception';

import { ApiException } from '../api-exception/index.js';
import type { IApiErrorCatalog, IApiErrorCatalogEntry } from './types.js';

/**
 * Defines the errors a module answers with in one place, by kind, as jg-exception's
 * defineErrorCatalog does, with each kind's response status: `create` builds the kind's
 * ApiException, and `is` tells whether an error is one of the catalog's, or of one kind, comparing
 * codes.
 * @param entries Each kind's code, message, status, and severity.
 * @returns The catalog.
 * @example
 * import { defineApiErrorCatalog } from 'jg-nestjs';
 *
 * const projectErrors = defineApiErrorCatalog({
 *   notFound: { code: 'PROJECT_NOT_FOUND', message: 'The project was not found.', status: 404, severity: 'expected' },
 *   nameTaken: { code: 'PROJECT_NAME_TAKEN', message: 'The project name is taken.', status: 409, severity: 'expected' },
 * });
 * const error = projectErrors.create('notFound', { data: { id: 42 } });
 * error.status; // => 404
 * projectErrors.is(error, 'notFound'); // => true
 */
export const defineApiErrorCatalog = <TKind extends string>(
  entries: Record<TKind, IApiErrorCatalogEntry>,
): IApiErrorCatalog<TKind> => {
  const { is } = defineErrorCatalog(entries);
  return {
    create: (kind, { cause, data } = {}) => {
      const { code, message, severity, status } = entries[kind];
      return new ApiException(message, { code, status, cause, data, severity });
    },
    is,
  };
};
