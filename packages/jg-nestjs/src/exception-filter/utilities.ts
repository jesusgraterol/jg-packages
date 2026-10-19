import { HttpException } from '@nestjs/common';
import { buildResponse, type IApiResponse } from 'jg-api-response';
import { DEFAULT_MESSAGE, Exception, getErrorCode, isException } from 'jg-exception';

import { ApiException } from '../api-exception/index.js';
import { DEFAULT_ERROR_STATUS, ERROR_MESSAGES, ERRORS, isErrorStatus } from '../shared/index.js';
import { DEFAULT_IGNORED_CODES, DEFAULT_IGNORED_STATUSES } from './constants.js';
import type {
  IApiExceptionFilterOptions,
  IExposedClientError,
  IResolvedFilterOptions,
} from './types.js';

/**
 * Fills in the defaults of the filter's options.
 * @param options The options provided, if any.
 * @returns The options with every default.
 */
export const resolveFilterOptions = (
  options: IApiExceptionFilterOptions | undefined,
): IResolvedFilterOptions => ({
  report: options?.report,
  resolveStatus: options?.resolveStatus,
  ignoredStatuses: options?.ignoredStatuses ?? DEFAULT_IGNORED_STATUSES,
  ignoredCodes: options?.ignoredCodes ?? DEFAULT_IGNORED_CODES,
  redactUrl: options?.redactUrl ?? ((url: string): string => url),
});

/**
 * Checks whether an error is a client error that Express's own middleware, such as a body parser,
 * built with http-errors: an integer `statusCode` from 400 to 499, `expose: true`, and a string
 * message. Only `expose` says the message is meant for clients, so an outbound HTTP client's error
 * that merely carries an upstream's status doesn't qualify.
 * @param error The error.
 * @returns Whether it's an exposed client error.
 */
export const isExposedClientError = (error: unknown): error is IExposedClientError => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { statusCode, expose, message } = error as Record<string, unknown>;
  return (
    typeof statusCode === 'number' &&
    Number.isInteger(statusCode) &&
    statusCode >= 400 &&
    statusCode <= 499 &&
    expose === true &&
    typeof message === 'string'
  );
};

/**
 * Resolves the status an error answers with: an ApiException's, an HttpException's, an exposed
 * client error's, the one resolveStatus gives when it's an error status, or 500.
 * @param error The error.
 * @param resolveStatus The app's resolver for other errors, if any.
 * @returns The status.
 */
export const resolveErrorStatus = (
  error: unknown,
  resolveStatus: IApiExceptionFilterOptions['resolveStatus'],
): number => {
  if (error instanceof ApiException) {
    return error.status;
  }
  if (error instanceof HttpException) {
    return error.getStatus();
  }
  if (isExposedClientError(error)) {
    return error.statusCode;
  }
  const resolved = resolveStatus?.(error);
  return isErrorStatus(resolved) ? resolved : DEFAULT_ERROR_STATUS;
};

/**
 * Reads the message of an HttpException from its response: the response itself when it's a
 * string, otherwise its string `message`, `msg`, `error`, or `err`, in that order.
 * @param exception The HttpException.
 * @returns The message, or jg-exception's DEFAULT_MESSAGE when there's none.
 */
export const extractHttpExceptionMessage = (exception: HttpException): string => {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if (typeof response !== 'object' || response === null) {
    return DEFAULT_MESSAGE;
  }
  for (const key of ['message', 'msg', 'error', 'err']) {
    const value = (response as Record<string, unknown>)[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return DEFAULT_MESSAGE;
};

/**
 * Builds the envelope an error answers with. An Exception sends its code, message, and data, an
 * HttpException or an exposed client error HTTP_EXCEPTION with its own message, and anything else
 * only INTERNAL_ERROR and a generic message, because its message may hold details a client must
 * never see.
 * @param error The error.
 * @returns The envelope.
 */
export const buildErrorBody = (error: unknown): IApiResponse<undefined> => {
  if (isException(error)) {
    return buildResponse(undefined, error);
  }
  if (error instanceof HttpException) {
    return buildResponse(
      undefined,
      new Exception(extractHttpExceptionMessage(error), { code: ERRORS.HTTP_EXCEPTION }),
    );
  }
  if (isExposedClientError(error)) {
    return buildResponse(undefined, new Exception(error.message, { code: ERRORS.HTTP_EXCEPTION }));
  }
  return buildResponse(
    undefined,
    new Exception(ERROR_MESSAGES.INTERNAL_ERROR, { code: ERRORS.INTERNAL_ERROR }),
  );
};

/**
 * Checks whether an error is logged: when its throw site asked with shouldLog or marked it
 * critical, or when it's none of an Exception, an HttpException, and an exposed client error, so
 * nothing anticipated it.
 * @param error The error.
 * @returns Whether to log it.
 */
export const shouldLogError = (error: unknown): boolean => {
  if (isException(error)) {
    return error.shouldLog === true || error.severity === 'critical';
  }
  return !(error instanceof HttpException) && !isExposedClientError(error);
};

/**
 * Checks whether an error is reported: always, unless its throw site marked it expected, or its
 * status or code is ignored.
 * @param error The error.
 * @param status The status it answered with.
 * @param options The filter's options.
 * @returns Whether to report it.
 */
export const shouldReportError = (
  error: unknown,
  status: number,
  { ignoredStatuses, ignoredCodes }: IResolvedFilterOptions,
): boolean => {
  if (isException(error) && error.severity === 'expected') {
    return false;
  }
  if (ignoredStatuses.includes(status)) {
    return false;
  }
  const code = getErrorCode(error);
  return code === null || !ignoredCodes.includes(code);
};
