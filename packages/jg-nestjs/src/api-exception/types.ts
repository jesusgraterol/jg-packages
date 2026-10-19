import type { IExceptionOptions } from 'jg-exception';

// the options an ApiException is created with: an Exception's, and the HTTP status to answer with
export type IApiExceptionOptions = IExceptionOptions & {
  // the response's status, an integer from 400 to 599. Anything else, or none, is 500
  status?: number | undefined;
};
