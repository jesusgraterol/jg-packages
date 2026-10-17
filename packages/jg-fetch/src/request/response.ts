import { isResponse } from 'jg-api-response';
import type { IJSONValue } from 'jg-exception';

import { parseRetryAfterMs } from '../retry-after/index.js';
import { ERROR_MESSAGES, type IHttpMethod } from '../shared/index.js';
import { RequestFailure, type IFailureDetails } from './failure.js';
import type { IResolvedOptions } from './options.js';

// the statuses whose responses have no body
const NO_BODY_STATUSES = new Set([204, 205, 304]);

/**
 * Reads a body as bytes, counting them as they stream, and stops once there are too many.
 * @param response The response.
 * @param maxBytes The most bytes to read.
 * @param details What the failure carries.
 * @returns A promise that resolves to the bytes.
 * @throws
 * - RESPONSE_TOO_LARGE: The response exceeded maxResponseBytes.
 */
const readBytes = async (
  response: Response,
  maxBytes: number,
  details: IFailureDetails,
): Promise<Uint8Array<ArrayBuffer>> => {
  if (response.body === null) {
    return new Uint8Array(0);
  }
  const declaredBytes = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
    await response.body.cancel();
    throw new RequestFailure('RESPONSE_TOO_LARGE', details);
  }
  // Node.js types the body's chunks as any; they're bytes in every runtime
  const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestFailure('RESPONSE_TOO_LARGE', details);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

/**
 * Decodes an error body: parsed JSON when it is JSON, otherwise its text, or undefined when empty.
 * @param text The body's text.
 * @returns The body.
 */
const toErrorBody = (text: string): unknown => {
  if (text === '') {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Builds the failure for an unsuccessful status.
 * @param status The status.
 * @param details What the failure carries.
 * @param body The response body.
 * @returns The failure.
 */
const httpError = (status: number, details: IFailureDetails, body: unknown): RequestFailure =>
  new RequestFailure('HTTP_ERROR', {
    ...details,
    message: `The server returned an unsuccessful status: ${status}.`,
    body,
  });

/**
 * Runs the schema on the parsed data, when there is one.
 * @param data The parsed data.
 * @param options The resolved options.
 * @param details What the failure carries.
 * @returns The data.
 * @throws
 * - RESPONSE_INVALID: The response data failed schema validation.
 */
const validate = <T>(data: unknown, options: IResolvedOptions<T>, details: IFailureDetails): T => {
  if (options.schema === undefined) {
    return data as T;
  }
  try {
    return options.schema.parse(data);
  } catch (error) {
    throw new RequestFailure('RESPONSE_INVALID', { ...details, cause: error });
  }
};

/**
 * Reads a jg-api-response envelope. An empty successful body gives undefined, a failed status or
 * success: false gives API_ERROR with the envelope error's code, message, and data, and the data
 * goes through the schema.
 * @param text The body's text.
 * @param response The response.
 * @param options The resolved options.
 * @param details What the failure carries.
 * @returns The envelope's data.
 * @throws
 * - HTTP_ERROR: An unsuccessful status without a valid envelope.
 * - PARSE_ERROR: A successful status whose body isn't JSON.
 * - ENVELOPE_INVALID: A successful status whose body isn't an envelope.
 * - API_ERROR: The API reported an error.
 * - RESPONSE_INVALID: The response data failed schema validation.
 */
const readEnvelope = <T>(
  text: string,
  response: Response,
  options: IResolvedOptions<T>,
  details: IFailureDetails,
): T => {
  if (text === '') {
    if (response.ok) {
      return undefined as T;
    }
    throw httpError(response.status, details, undefined);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw response.ok
      ? new RequestFailure('PARSE_ERROR', { ...details, body: text, cause: error })
      : httpError(response.status, details, text);
  }
  if (!isResponse(parsed)) {
    throw response.ok
      ? new RequestFailure('ENVELOPE_INVALID', { ...details, body: parsed })
      : httpError(response.status, details, parsed);
  }
  if (!response.ok || !parsed.success) {
    const { error } = parsed;
    throw new RequestFailure('API_ERROR', {
      ...details,
      message: error?.message || ERROR_MESSAGES.API_ERROR,
      code: error?.code || 'API_ERROR',
      // isResponse leaves the error's data unchecked, but it came from JSON.parse, which only
      // produces JSON values. Services may leave it out, so a missing one becomes null
      data: (error?.data as IJSONValue | undefined) ?? null,
      body: parsed,
    });
  }
  return validate(parsed.data, options, details);
};

/**
 * Reads a response the way parseAs asks, after checking its status.
 * @param response The response.
 * @param method The request's method.
 * @param options The resolved options.
 * @returns A promise that resolves to the data.
 * @throws
 * - HTTP_ERROR: The server returned an unsuccessful status.
 * - API_ERROR: The API reported an error.
 * - PARSE_ERROR: The response body could not be parsed.
 * - ENVELOPE_INVALID: The response is not a valid API envelope.
 * - RESPONSE_INVALID: The response data failed schema validation.
 * - RESPONSE_TOO_LARGE: The response exceeded maxResponseBytes.
 */
export const readResponse = async <T>(
  response: Response,
  method: IHttpMethod,
  options: IResolvedOptions<T>,
): Promise<T> => {
  const details: IFailureDetails = {
    status: response.status,
    headers: response.headers,
    retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
  };
  const hasBody = method !== 'HEAD' && !NO_BODY_STATUSES.has(response.status);
  const readText = async (): Promise<string> =>
    hasBody
      ? new TextDecoder().decode(await readBytes(response, options.maxResponseBytes, details))
      : '';

  if (options.parseAs === 'response' || options.parseAs === 'none') {
    if (!response.ok) {
      let body: unknown;
      try {
        body = toErrorBody(await readText());
      } catch (error) {
        // the status is the failure; a body too large to read is left out
        if (!(error instanceof RequestFailure)) {
          throw error;
        }
      }
      throw httpError(response.status, details, body);
    }
    if (options.parseAs === 'response') {
      return validate(response, options, details);
    }
    await response.body?.cancel();
    return validate(undefined, options, details);
  }

  if (options.parseAs === 'bytes' || options.parseAs === 'blob') {
    const bytes = hasBody
      ? await readBytes(response, options.maxResponseBytes, details)
      : new Uint8Array(0);
    if (!response.ok) {
      throw httpError(response.status, details, toErrorBody(new TextDecoder().decode(bytes)));
    }
    return validate(
      options.parseAs === 'bytes'
        ? bytes
        : new Blob([bytes], {
            type: response.headers.get('content-type') ?? '',
          }),
      options,
      details,
    );
  }

  const text = await readText();
  if (options.parseAs === 'envelope') {
    return readEnvelope(text, response, options, details);
  }
  if (!response.ok) {
    throw httpError(response.status, details, toErrorBody(text));
  }
  if (options.parseAs === 'text') {
    return validate(text, options, details);
  }
  let data: unknown;
  try {
    data = text === '' ? undefined : JSON.parse(text);
  } catch (error) {
    throw new RequestFailure('PARSE_ERROR', { ...details, body: text, cause: error });
  }
  return validate(data, options, details);
};
