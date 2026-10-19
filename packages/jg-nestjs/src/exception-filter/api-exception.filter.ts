import type { IncomingMessage } from 'node:http';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { isException } from 'jg-exception';

import { API_EXCEPTION_FILTER_OPTIONS } from './constants.js';
import type { IApiExceptionFilterOptions, IErrorReport, IResolvedFilterOptions } from './types.js';
import {
  buildErrorBody,
  resolveErrorStatus,
  resolveFilterOptions,
  shouldLogError,
  shouldReportError,
} from './utilities.js';

/**
 * Answers every error an HTTP request throws, from a handler, guard, pipe, or middleware, with the
 * jg-api-response envelope. An ApiException sets the status; an Exception sends its code, message,
 * and data; an HttpException sends HTTP_EXCEPTION with its own message; and anything else gets a
 * 500 with INTERNAL_ERROR and a generic message, while the error itself goes only to the logs and
 * the reporter. It logs an error that its throw site marked shouldLog or critical, or that is
 * neither an Exception nor an HttpException, and reports every error except an expected one or one
 * whose status or code is ignored. Errors outside HTTP are rethrown.
 * @example
 * import { Module } from '@nestjs/common';
 * import { APP_FILTER } from '@nestjs/core';
 * import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter, type IApiExceptionFilterOptions } from 'jg-nestjs';
 *
 * const filterOptions: IApiExceptionFilterOptions = {
 *   redactUrl: (url) => url.replace(/token=[^&]+/, 'token=[redacted]'),
 * };
 *
 * @Module({
 *   providers: [
 *     { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: filterOptions },
 *     { provide: APP_FILTER, useClass: ApiExceptionFilter },
 *   ],
 * })
 * export class AppModule {}
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly __logger = new Logger(ApiExceptionFilter.name);

  private readonly __options: IResolvedFilterOptions;

  /**
   * Creates the filter. Nest injects its arguments.
   * @param adapterHost The host of the HTTP adapter the response is sent through.
   * @param options How errors are reported and logged, from API_EXCEPTION_FILTER_OPTIONS.
   */
  constructor(
    @Inject(HttpAdapterHost) private readonly __adapterHost: HttpAdapterHost,
    @Optional() @Inject(API_EXCEPTION_FILTER_OPTIONS) options?: IApiExceptionFilterOptions,
  ) {
    this.__options = resolveFilterOptions(options);
  }

  /**
   * Answers an error with the envelope, after logging and reporting it.
   * @param error The error.
   * @param host The request's context.
   */
  public catch(error: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw error;
    }
    const http = host.switchToHttp();
    const request = http.getRequest<IncomingMessage & { originalUrl?: string }>();
    const response = http.getResponse<unknown>();
    const status = resolveErrorStatus(error, this.__options.resolveStatus);
    const url = this.__options.redactUrl(request.originalUrl ?? request.url ?? '');
    const context = { method: request.method, url, status };

    if (shouldLogError(error)) {
      this.__logger.error(error, context);
    }
    if (shouldReportError(error, status, this.__options)) {
      this.__report({
        error,
        status,
        severity: isException(error) ? error.severity : undefined,
        request,
        url,
      });
    }

    const { httpAdapter } = this.__adapterHost;
    if (httpAdapter.isHeadersSent(response) === true) {
      this.__logger.error(
        "The response had already started, so the error wasn't answered.",
        context,
      );
      return;
    }
    httpAdapter.reply(response, buildErrorBody(error), status);
  }

  /**
   * Hands an error to the reporter without waiting for it, logging the reporter's own failure.
   * @param report The error and its request.
   */
  private __report(report: IErrorReport): void {
    const { report: reporter } = this.__options;
    if (reporter === undefined) {
      return;
    }
    const send = async (): Promise<void> => {
      await reporter(report);
    };
    send().catch((failure: unknown) => {
      this.__logger.error('The error reporter failed.', failure, {
        method: report.request.method,
        url: report.url,
        status: report.status,
      });
    });
  }
}
