import type { Exception, IErrorCatalogEntry, IErrorCatalogOptions } from 'jg-exception';

import type { ApiException } from '../api-exception/index.js';

// one kind of an API error catalog: an error catalog entry and the response's status
export type IApiErrorCatalogEntry = IErrorCatalogEntry & {
  // the response's status, an integer from 400 to 599
  status: number;
};

// what defineApiErrorCatalog returns: a catalog that creates ApiExceptions
export type IApiErrorCatalog<TKind extends string> = {
  // creates the kind's ApiException, with its code, message, severity, and status
  create: (kind: TKind, options?: IErrorCatalogOptions) => ApiException;

  // whether an error is an Exception with one of the catalog's codes, or with the kind's code
  is: (error: unknown, kind?: TKind) => error is Exception;
};
