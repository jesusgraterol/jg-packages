import { Exception } from 'jg-exception';

import { DEFAULT_ERROR_STATUS, isErrorStatus } from '../shared/index.js';
import type { IApiExceptionOptions } from './types.js';

/**
 * An Exception that sets the HTTP status of the response ApiExceptionFilter sends: its code,
 * message, and data go to the client in the jg-api-response envelope, so they must be safe to
 * show. The status is an integer from 400 to 599, and 500 when it's missing or anything else.
 * @example
 * import { ApiException } from 'jg-nestjs';
 *
 * throw new ApiException('The project was not found.', {
 *   code: 'PROJECT_NOT_FOUND',
 *   status: 404,
 *   data: { id: 42 },
 *   severity: 'expected',
 * });
 */
export class ApiException extends Exception {
  // the response's status, from 400 to 599
  public readonly status: number;

  /**
   * Creates an API exception.
   * @param message What failed, which the client sees.
   * @param options An Exception's options, and the response's `status`.
   */
  constructor(message: string, options: IApiExceptionOptions) {
    // callers that skip type checking may leave the options out, and creating an error mustn't throw
    const { status, ...exceptionOptions } = (options as IApiExceptionOptions | undefined) ?? {
      code: '',
    };
    super(message, exceptionOptions);
    this.name = 'ApiException';
    this.status = isErrorStatus(status) ? status : DEFAULT_ERROR_STATUS;
  }
}
