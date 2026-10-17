import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_RETRY_AFTER_SECONDS,
  DEFAULT_RETRY_DELAYS_SECONDS,
  DEFAULT_RETRY_METHODS,
  DEFAULT_RETRY_STATUS_CODES,
  DEFAULT_TIMEOUT_SECONDS,
  ERROR_MESSAGES,
  MAX_TIMEOUT_SECONDS,
  type IHttpMethod,
  type IParseAs,
  type IQueryParams,
  type IRequestOptions,
} from '../shared/index.js';
import { RequestFailure } from './failure.js';

// the methods request sends
const HTTP_METHODS: readonly IHttpMethod[] = [
  'GET',
  'HEAD',
  'OPTIONS',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
];

// the ways request reads a response
const PARSE_AS: readonly IParseAs[] = [
  'envelope',
  'json',
  'text',
  'bytes',
  'blob',
  'response',
  'none',
];

// the query values that become a parameter
const QUERY_VALUE_TYPES = new Set(['string', 'number', 'boolean', 'bigint']);

// the page's location in a browser, which relative URLs resolve against without a baseUrl
const locationGlobals = globalThis as { location?: { href: string } };

// the options with their defaults applied, in milliseconds, once validated
export type IResolvedOptions<T> = {
  method: IHttpMethod;
  parseAs: IParseAs;
  timeoutMs: number;
  attemptTimeoutMs: number | undefined;
  retryDelaysMs: number[];
  retryMethods: readonly IHttpMethod[];
  retryStatusCodes: readonly number[];
  nonRetryableErrorCodes: readonly string[];
  maxRetryAfterMs: number;
  maxResponseBytes: number;
  headers: IRequestOptions<T>['headers'];
  schema: IRequestOptions<T>['schema'];
  signal: AbortSignal | undefined;
  init: IRequestOptions<T>['init'];
  onRetry: IRequestOptions<T>['onRetry'];
};

// the body as fetch receives it
export type ISerializedBody = {
  value: RequestInit['body'];

  // whether it was serialized to JSON, which sets Content-Type: application/json
  isJson: boolean;

  // whether it's a stream, which can be sent once and so never retries
  isStream: boolean;
};

/**
 * Builds the failure for an invalid option.
 * @param detail What's wrong.
 * @returns The failure.
 */
const invalidOption = (detail: string): RequestFailure =>
  new RequestFailure('INVALID_OPTIONS', { message: `${ERROR_MESSAGES.INVALID_OPTIONS} ${detail}` });

/**
 * Checks a number of seconds.
 * @param name The option's name.
 * @param value The option's value.
 * @param allowZero Whether 0 is valid.
 * @returns The value in whole milliseconds, rounded up, because timers such as AbortSignal.timeout
 * reject fractions. A value above 0 gives at least 1.
 */
const toMs = (name: string, value: unknown, allowZero: boolean): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (!allowZero && value === 0) ||
    value > MAX_TIMEOUT_SECONDS
  ) {
    throw invalidOption(
      `${name} must be a number of seconds ${allowZero ? 'from 0' : 'above 0'} up to ${MAX_TIMEOUT_SECONDS}.`,
    );
  }
  const ms = Math.ceil(value * 1000);
  return allowZero ? ms : Math.max(1, ms);
};

/**
 * Checks that an option is an array whose items pass a check.
 * @param name The option's name.
 * @param value The option's value.
 * @param isValid Checks one item.
 * @param description What each item must be, for the message.
 * @returns The array.
 */
const checkArray = <T>(
  name: string,
  value: unknown,
  isValid: (item: unknown) => boolean,
  description: string,
): readonly T[] => {
  if (!Array.isArray(value) || !value.every(isValid)) {
    throw invalidOption(`${name} must be an array of ${description}.`);
  }
  return value as readonly T[];
};

/**
 * Checks whether a value is an HTTP method request sends.
 * @param value The value.
 * @returns Whether it's one.
 */
const isHttpMethod = (value: unknown): value is IHttpMethod =>
  HTTP_METHODS.includes(value as IHttpMethod);

/**
 * Applies the defaults and validates every option, so request can report INVALID_OPTIONS instead
 * of failing halfway.
 * @param options The options.
 * @returns The resolved options.
 * @throws
 * - INVALID_OPTIONS: The request options are invalid.
 */
export const resolveOptions = <T>(options: IRequestOptions<T>): IResolvedOptions<T> => {
  if (typeof options !== 'object' || options === null) {
    throw invalidOption('The options must be an object.');
  }
  const method = options.method ?? 'GET';
  if (!isHttpMethod(method)) {
    throw invalidOption(`method must be one of ${HTTP_METHODS.join(', ')}.`);
  }
  const parseAs = options.parseAs ?? 'json';
  if (!PARSE_AS.includes(parseAs)) {
    throw invalidOption(`parseAs must be one of ${PARSE_AS.join(', ')}.`);
  }
  if (
    (method === 'GET' || method === 'HEAD') &&
    options.body !== undefined &&
    options.body !== null
  ) {
    throw invalidOption(`A ${method} request can't have a body.`);
  }
  if (
    options.headers !== undefined &&
    typeof options.headers !== 'function' &&
    (typeof options.headers !== 'object' || options.headers === null)
  ) {
    throw invalidOption('headers must be headers or a function that returns them.');
  }
  if (
    options.schema !== undefined &&
    (typeof options.schema !== 'object' ||
      options.schema === null ||
      typeof options.schema.parse !== 'function')
  ) {
    throw invalidOption('schema must have a parse method.');
  }
  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw invalidOption('signal must be an AbortSignal.');
  }
  if (options.onRetry !== undefined && typeof options.onRetry !== 'function') {
    throw invalidOption('onRetry must be a function.');
  }
  if (options.init !== undefined && (typeof options.init !== 'object' || options.init === null)) {
    throw invalidOption('init must be an object.');
  }
  if (
    options.maxResponseBytes !== undefined &&
    (!Number.isSafeInteger(options.maxResponseBytes) || options.maxResponseBytes <= 0)
  ) {
    throw invalidOption('maxResponseBytes must be a whole number of bytes above 0.');
  }
  return {
    method,
    parseAs,
    timeoutMs: toMs('timeoutSeconds', options.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS, false),
    attemptTimeoutMs:
      options.attemptTimeoutSeconds === undefined
        ? undefined
        : toMs('attemptTimeoutSeconds', options.attemptTimeoutSeconds, false),
    retryDelaysMs: checkArray<number>(
      'retryDelaysSeconds',
      options.retryDelaysSeconds ?? DEFAULT_RETRY_DELAYS_SECONDS,
      (item) =>
        typeof item === 'number' &&
        Number.isFinite(item) &&
        item >= 0 &&
        item <= MAX_TIMEOUT_SECONDS,
      `seconds from 0 up to ${MAX_TIMEOUT_SECONDS}`,
    ).map((seconds) => seconds * 1000),
    retryMethods: checkArray<IHttpMethod>(
      'retryMethods',
      options.retryMethods ?? DEFAULT_RETRY_METHODS,
      isHttpMethod,
      'HTTP methods',
    ),
    retryStatusCodes: checkArray<number>(
      'retryStatusCodes',
      options.retryStatusCodes ?? DEFAULT_RETRY_STATUS_CODES,
      (item) => Number.isInteger(item) && (item as number) >= 100 && (item as number) <= 599,
      'HTTP statuses from 100 to 599',
    ),
    nonRetryableErrorCodes: checkArray<string>(
      'nonRetryableErrorCodes',
      options.nonRetryableErrorCodes ?? [],
      (item) => typeof item === 'string',
      'strings',
    ),
    maxRetryAfterMs: toMs(
      'maxRetryAfterSeconds',
      options.maxRetryAfterSeconds ?? DEFAULT_MAX_RETRY_AFTER_SECONDS,
      true,
    ),
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    headers: options.headers,
    schema: options.schema,
    signal: options.signal,
    init: options.init,
    onRetry: options.onRetry,
  };
};

/**
 * Builds the request's URL from the url, the baseUrl or, in a browser, the page's location, and
 * the query parameters.
 * @param url The URL, absolute or relative.
 * @param baseUrl The URL a relative url resolves against.
 * @param query The query parameters.
 * @returns The URL.
 * @throws
 * - INVALID_URL: The request URL is invalid or outside the base origin.
 * - INVALID_OPTIONS: A query parameter's value isn't a string, number, boolean, or bigint.
 */
export const buildUrl = (
  url: string | URL,
  baseUrl: string | URL | undefined,
  query: IQueryParams | undefined,
): URL => {
  const base = baseUrl ?? locationGlobals.location?.href;
  let target: URL;
  try {
    target = base === undefined ? new URL(url) : new URL(url, base);
  } catch (error) {
    throw new RequestFailure('INVALID_URL', { cause: error });
  }
  if (
    (target.protocol !== 'http:' && target.protocol !== 'https:') ||
    (baseUrl !== undefined && target.origin !== new URL(baseUrl).origin)
  ) {
    throw new RequestFailure('INVALID_URL');
  }
  if (query !== undefined) {
    if (typeof query !== 'object' || query === null) {
      throw invalidOption('query must be an object.');
    }
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item === null || item === undefined || item === '') {
          continue;
        }
        if (!QUERY_VALUE_TYPES.has(typeof item)) {
          throw invalidOption(
            `The query parameter '${key}' must be a string, number, boolean, or bigint, or an array of them.`,
          );
        }
        target.searchParams.append(key, String(item));
      }
    }
  }
  return target;
};

/**
 * Removes what can hold secrets from a URL, such as tokens in the query string, for messages and
 * the meta.
 * @param url The URL.
 * @returns The origin and path.
 */
export const toSafeUrl = (url: URL | string): string => {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return '';
  }
};

/**
 * Checks whether a body is a plain object or an array, which is sent as JSON.
 * @param body The body.
 * @returns Whether it's sent as JSON.
 */
const isJsonBody = (body: unknown): boolean => {
  if (Array.isArray(body)) {
    return true;
  }
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(body);
  return prototype === Object.prototype || prototype === null;
};

/**
 * Prepares the body for fetch: plain objects and arrays become JSON, and anything else passes
 * through.
 * @param body The body.
 * @returns The serialized body.
 * @throws
 * - INVALID_BODY: The request body could not be serialized.
 */
export const serializeBody = (body: IRequestOptions<unknown>['body']): ISerializedBody => {
  if (body === undefined || body === null) {
    return { value: undefined, isJson: false, isStream: false };
  }
  if (isJsonBody(body)) {
    try {
      return { value: JSON.stringify(body), isJson: true, isStream: false };
    } catch (error) {
      throw new RequestFailure('INVALID_BODY', { cause: error });
    }
  }
  return {
    value: body as RequestInit['body'],
    isJson: false,
    isStream: typeof ReadableStream !== 'undefined' && body instanceof ReadableStream,
  };
};
