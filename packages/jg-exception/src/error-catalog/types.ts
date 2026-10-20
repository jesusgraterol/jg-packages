import type { Exception, IExceptionSeverity } from '../exception/index.js';
import type { IJsonValue } from '../shared/types.js';

// one error a catalog defines: its stable code, its message, and how serious it is
export type IErrorCatalogEntry = {
  code: string;
  message: string;
  severity?: IExceptionSeverity | undefined;
};

// what one catalog error is created with, beyond its entry
export type IErrorCatalogOptions = {
  // the error underneath, kept as the native `cause`
  cause?: unknown;

  // context that helps whoever handles or debugs the error
  data?: IJsonValue | undefined;
};

// the errors a module throws, each created and recognized by its kind
export type IErrorCatalog<TKind extends string> = {
  // creates the kind's Exception, with its code, message, and severity
  create: (kind: TKind, options?: IErrorCatalogOptions) => Exception;

  // whether a value is an Exception with the kind's code, or, without a kind, any of the catalog's
  is: (error: unknown, kind?: TKind) => error is Exception;
};
