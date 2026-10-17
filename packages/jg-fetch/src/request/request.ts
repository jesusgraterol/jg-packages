import { delay } from 'jg-toolkit';

import { FetchException } from '../fetch-exception/index.js';
import type {
  IFetchErrorKind,
  IHttpMethod,
  IRequestOptions,
  IRequestResult,
  IResponseMeta,
} from '../shared/index.js';
import { RequestFailure, type IFailureDetails } from './failure.js';
import {
  buildUrl,
  resolveOptions,
  serializeBody,
  toSafeUrl,
  type IResolvedOptions,
  type ISerializedBody,
} from './options.js';
import { readResponse } from './response.js';
import { decideRetry } from './retry.js';

/**
 * Checks whether an abort's reason is a timeout, such as AbortSignal.timeout's.
 * @param reason The abort's reason.
 * @returns Whether it's a timeout.
 */
const isTimeoutReason = (reason: unknown): boolean =>
  typeof reason === 'object' &&
  reason !== null &&
  'name' in reason &&
  reason.name === 'TimeoutError';

/**
 * Turns whatever stopped an attempt into a failure: a known failure as it is, an abort into
 * TIMEOUT or ABORTED, and anything else into NETWORK_ERROR.
 * @param error What the attempt threw.
 * @param callSignal The whole call's signal.
 * @param attemptSignal The attempt's signal.
 * @returns The failure.
 */
const toFailure = (
  error: unknown,
  callSignal: AbortSignal,
  attemptSignal: AbortSignal,
): RequestFailure => {
  if (error instanceof RequestFailure) {
    return error;
  }
  if (callSignal.aborted) {
    return new RequestFailure(isTimeoutReason(callSignal.reason) ? 'TIMEOUT' : 'ABORTED', {
      cause: callSignal.reason,
    });
  }
  if (attemptSignal.aborted) {
    return new RequestFailure('TIMEOUT', { cause: attemptSignal.reason, isAttemptTimeout: true });
  }
  return new RequestFailure('NETWORK_ERROR', { cause: error });
};

/**
 * Builds an attempt's headers, running the headers function when there is one.
 * @param options The resolved options.
 * @param body The serialized body.
 * @param attempt The attempt's number.
 * @param signal The attempt's signal.
 * @returns A promise that resolves to the headers.
 * @throws
 * - INVALID_HEADERS: The request headers could not be built.
 */
const buildHeaders = async <T>(
  options: IResolvedOptions<T>,
  body: ISerializedBody,
  attempt: number,
  signal: AbortSignal,
): Promise<Headers> => {
  let headers: Headers;
  try {
    const init =
      typeof options.headers === 'function'
        ? await options.headers({ attempt, signal })
        : options.headers;
    headers = new Headers(init);
  } catch (error) {
    throw new RequestFailure('INVALID_HEADERS', { cause: error });
  }
  if (body.isJson && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return headers;
};

/**
 * Runs one attempt: builds a fresh Request, sends it, and reads the response.
 * @param target The URL.
 * @param body The serialized body.
 * @param options The resolved options.
 * @param attempt The attempt's number.
 * @param signal The attempt's signal.
 * @param onResponse Receives the response before it's read, for the meta.
 * @returns A promise that resolves to the data.
 */
const runAttempt = async <T>(
  target: URL,
  body: ISerializedBody,
  options: IResolvedOptions<T>,
  attempt: number,
  signal: AbortSignal,
  onResponse: (response: Response) => void,
): Promise<T> => {
  const headers = await buildHeaders(options, body, attempt, signal);
  let request: Request;
  try {
    // a streamed body needs duplex: 'half', which RequestInit doesn't type everywhere yet
    const init: RequestInit & { duplex?: 'half' } = {
      ...options.init,
      method: options.method,
      headers,
      body: body.value ?? null,
      signal,
      ...(body.isStream ? { duplex: 'half' } : {}),
    };
    request = new Request(target, init);
  } catch (error) {
    throw new RequestFailure('INVALID_OPTIONS', { cause: error });
  }
  const response = await fetch(request);
  onResponse(response);
  return readResponse(response, options.method, options);
};

/**
 * Sends an HTTP request and resolves to its data or its error, never throwing. It retries network
 * errors, attempt timeouts, and retryable statuses for the methods that may retry, waiting
 * retryDelaysSeconds between attempts, or longer when the server sends Retry-After, all within
 * timeoutSeconds. Each attempt sends a fresh Request. With parseAs 'envelope', it reads a
 * jg-api-response envelope and resolves to its data, or to API_ERROR with the API's own code.
 * @param url The URL, absolute or relative to baseUrl.
 * @param options The method, query, headers, body, how to read the response, and the timeouts
 * and retries.
 * @returns A promise that resolves to `{ data, error: null, meta }` or `{ data: null, error,
 * meta }`, where error is a FetchException.
 * @example
 * const { data, error } = await request<IUser>('/users/1', {
 *   baseUrl: 'https://api.example.com',
 *   parseAs: 'envelope',
 *   headers: async () => ({ authorization: `Bearer ${await getToken()}` }),
 * });
 * if (error) {
 *   error.kind; // such as 'API_ERROR' or 'TIMEOUT'
 * }
 * @example
 * const { data: html } = await request('https://example.com', { parseAs: 'text' }); // string | null
 */
export function request(
  url: string | URL,
  options: IRequestOptions<string> & { parseAs: 'text' },
): Promise<IRequestResult<string>>;
export function request(
  url: string | URL,
  options: IRequestOptions<Uint8Array> & { parseAs: 'bytes' },
): Promise<IRequestResult<Uint8Array>>;
export function request(
  url: string | URL,
  options: IRequestOptions<Blob> & { parseAs: 'blob' },
): Promise<IRequestResult<Blob>>;
export function request(
  url: string | URL,
  options: IRequestOptions<Response> & { parseAs: 'response' },
): Promise<IRequestResult<Response>>;
export function request(
  url: string | URL,
  options: IRequestOptions<undefined> & { parseAs: 'none' },
): Promise<IRequestResult<undefined>>;
export function request<T = unknown>(
  url: string | URL,
  options?: IRequestOptions<T>,
): Promise<IRequestResult<T>>;
export async function request<T>(
  url: string | URL,
  options: IRequestOptions<T> = {},
): Promise<IRequestResult<T>> {
  const startedAt = performance.now();
  const getDurationMs = (): number => Math.round(performance.now() - startedAt);
  let method: IHttpMethod = 'GET';
  let safeUrl = '';
  let attempts = 0;
  let lastResponse: Response | undefined;
  const getMeta = (): IResponseMeta => ({
    status: lastResponse?.status ?? null,
    headers: lastResponse?.headers ?? null,
    url: lastResponse?.url ? toSafeUrl(lastResponse.url) : safeUrl,
    attempts,
    durationMs: getDurationMs(),
  });
  const toResult = (kind: IFetchErrorKind, details: IFailureDetails): IRequestResult<T> => {
    const meta = getMeta();
    return {
      data: null,
      error: new FetchException(kind, {
        ...details,
        method,
        url: meta.url,
        attempts,
        durationMs: meta.durationMs,
      }),
      meta,
    };
  };

  let resolved: IResolvedOptions<T>;
  let target: URL;
  let body: ISerializedBody;
  try {
    resolved = resolveOptions(options);
    method = resolved.method;
    target = buildUrl(url, options.baseUrl, options.query);
    safeUrl = toSafeUrl(target);
    body = serializeBody(options.body);
  } catch (error) {
    const failure =
      error instanceof RequestFailure
        ? error
        : new RequestFailure('INVALID_OPTIONS', { cause: error });
    return toResult(failure.kind, failure.details);
  }

  // the whole call's deadline, combined with the caller's signal
  const timeoutSignal = AbortSignal.timeout(resolved.timeoutMs);
  const callSignal =
    resolved.signal === undefined
      ? timeoutSignal
      : AbortSignal.any([resolved.signal, timeoutSignal]);

  for (attempts = 1; ; attempts += 1) {
    const attemptSignal =
      resolved.attemptTimeoutMs === undefined
        ? callSignal
        : AbortSignal.any([callSignal, AbortSignal.timeout(resolved.attemptTimeoutMs)]);
    let failure: RequestFailure;
    try {
      const data = await runAttempt(target, body, resolved, attempts, attemptSignal, (response) => {
        lastResponse = response;
      });
      return { data, error: null, meta: getMeta() };
    } catch (error) {
      failure = toFailure(error, callSignal, attemptSignal);
    }

    const decision = decideRetry({
      attempt: attempts,
      method,
      kind: failure.kind,
      code: failure.details.code ?? failure.kind,
      status: failure.details.status ?? null,
      isAttemptTimeout: failure.details.isAttemptTimeout === true,
      retryAfterMs: failure.details.retryAfterMs ?? null,
      hasStreamBody: body.isStream,
      remainingMs: startedAt + resolved.timeoutMs - performance.now(),
      retryDelaysMs: resolved.retryDelaysMs,
      retryMethods: resolved.retryMethods,
      retryStatusCodes: resolved.retryStatusCodes,
      nonRetryableErrorCodes: resolved.nonRetryableErrorCodes,
      maxRetryAfterMs: resolved.maxRetryAfterMs,
    });
    if (!decision.shouldRetry) {
      return toResult(failure.kind, failure.details);
    }
    try {
      const { error } = toResult(failure.kind, failure.details);
      if (error !== null) {
        resolved.onRetry?.({ attempt: attempts, error, delayMs: decision.delayMs });
      }
    } catch {
      // onRetry is a notification; its failures never stop the call
    }
    try {
      await delay(decision.delayMs / 1000, { signal: callSignal });
    } catch {
      const stopped = toFailure(undefined, callSignal, callSignal);
      return toResult(stopped.kind, stopped.details);
    }
  }
}
