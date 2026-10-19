import type { ServerResponse } from 'node:http';

import type { ILoggedRequest, IRequestLogParams } from './types.js';

/**
 * Picks the level a request is logged at: `error` for a 5xx, `warn` for a 4xx, `log` otherwise.
 * @param status The response's status.
 * @returns The Logger method.
 */
export const getRequestLogLevel = (status: number): 'error' | 'warn' | 'log' => {
  if (status >= 500) {
    return 'error';
  }
  return status >= 400 ? 'warn' : 'log';
};

/**
 * Reads a header that arrives once as a string.
 * @param value The header's value.
 * @returns The value, or undefined when it's missing, empty, or repeated.
 */
const readSingleHeader = (value: string | string[] | number | undefined): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/**
 * Builds what a request's log line carries besides its message: the client's address, its user
 * agent, its redacted referer, and the response's size in bytes, each only when it's known.
 * @param request The request.
 * @param response The finished response.
 * @param redactUrl Removes secrets from the referer.
 * @returns The fields.
 */
export const buildRequestLogParams = (
  request: ILoggedRequest,
  response: ServerResponse,
  redactUrl: (url: string) => string,
): IRequestLogParams => {
  const ip = request.ip ?? request.socket.remoteAddress;
  const userAgent = readSingleHeader(request.headers['user-agent']);
  const referer = readSingleHeader(request.headers.referer);
  const responseSize = Number(response.getHeader('content-length'));
  return {
    ...(ip === undefined ? {} : { ip }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(referer === undefined ? {} : { referer: redactUrl(referer) }),
    ...(Number.isSafeInteger(responseSize) && responseSize >= 0 ? { responseSize } : {}),
  };
};
