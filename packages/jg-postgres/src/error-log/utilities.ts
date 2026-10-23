import { hashValue } from 'jg-crypto';
import {
  DEFAULT_MESSAGE,
  Exception,
  extractMessage,
  getErrorCode,
  redactFields,
} from 'jg-exception';
import { isIntegerValid, isObjectValid } from 'jg-utilities';

import { ERRORS, isBoundedString } from '../shared/index.js';
import type { IErrorLogEntry, IErrorLogOptions } from './types.js';

// what a cut message ends with
const TRUNCATION_SUFFIX = ' [truncated]';

/*
 * The most levels of objects and arrays a stored value may hold, as in jg-exception. Data nested
 * deeper is left out like data that can't be serialized, so whether it's stored never depends on
 * how much of the call stack is left.
 */
const MAX_NESTING_DEPTH = 256;

// one entry, as its row stores it
export type IErrorLogRow = {
  origin: string;
  error: string;
  userInfo: string | null;
  payload: string | null;
  deduplicationHash: string | null;
};

/**
 * Builds the exception for options that aren't valid.
 * @returns The INVALID_ERROR_LOG_OPTIONS exception.
 */
export const invalidOptions = (): Exception =>
  new Exception(
    "The error log needs an origin of 1 to 256 characters, redact keys that are strings, a whole message length of at least 16, a whole payload size of at least 16 bytes, a whole batch size from 1 to 8192, and an onRecorded that's a function when it's given.",
    { code: ERRORS.INVALID_ERROR_LOG_OPTIONS },
  );

/**
 * Checks the options createErrorLog validates itself; the table and the timeouts are checked by
 * quoteIdentifier and assertTimeoutProfile.
 * @param options The options.
 * @returns Whether they're valid.
 */
export const areOptionsValid = ({
  origin,
  redactKeys = [],
  maxMessageLength = 0,
  maxPayloadBytes = 0,
  maxBatchSize = 0,
  onRecorded,
}: Partial<IErrorLogOptions>): boolean =>
  isBoundedString(origin, 256) &&
  Array.isArray(redactKeys) &&
  redactKeys.every((key: unknown) => typeof key === 'string') &&
  isIntegerValid(maxMessageLength, 16) &&
  isIntegerValid(maxPayloadBytes, 16) &&
  isIntegerValid(maxBatchSize, 1, 8_192) &&
  (onRecorded === undefined || typeof onRecorded === 'function');

/**
 * Copies JSON-like data so PostgreSQL's jsonb takes it: an object or array it's already inside is
 * left out, as JSON.stringify would leave out a function, null characters are removed from keys
 * and strings, a BigInt becomes its digits, and a value with toJSON, such as a Date, is replaced by
 * what it returns, in its place.
 * @param value The data.
 * @param ancestors The objects the value is inside.
 * @param depth How many objects and arrays the value is inside, 0 for the data itself.
 * @returns The copy.
 * @throws
 * - The value is nested too deeply to store.
 */
const toStorableJson = (value: unknown, ancestors: Set<object>, depth: number): unknown => {
  if (typeof value === 'string') {
    return value.replaceAll('\0', '');
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (ancestors.has(value)) {
    return undefined;
  }
  const { toJSON } = value as { toJSON?: unknown };
  if (typeof toJSON === 'function') {
    return toStorableJson((toJSON as () => unknown).call(value), ancestors, depth);
  }
  // the copy stops at a fixed depth rather than where the call stack runs out; serializeObject
  // catches this
  if (depth >= MAX_NESTING_DEPTH) {
    throw new RangeError('The value is nested too deeply to store.');
  }
  ancestors.add(value);
  const copy = Array.isArray(value)
    ? value.map((item: unknown) => toStorableJson(item, ancestors, depth + 1))
    : Object.fromEntries(
        Object.entries(value).map(([key, field]) => [
          key.replaceAll('\0', ''),
          toStorableJson(field, ancestors, depth + 1),
        ]),
      );
  ancestors.delete(value);
  return copy;
};

/**
 * Serializes an object for a jsonb column, or gives null when it isn't a plain object, can't be
 * serialized, is nested more than `MAX_NESTING_DEPTH` levels deep, or takes more than the bytes
 * allowed.
 * @param value The object.
 * @param maxBytes The most bytes its JSON may take.
 * @returns The JSON, or null.
 */
export const serializeObject = (value: unknown, maxBytes: number): string | null => {
  if (!isObjectValid(value, true)) {
    return null;
  }
  try {
    const json = JSON.stringify(toStorableJson(value, new Set(), 0));
    return Buffer.byteLength(json, 'utf8') <= maxBytes ? json : null;
  } catch {
    // data that can't be copied, such as data nested too deeply or a getter that throws, is left
    // out, like oversized data
    return null;
  }
};

/**
 * Builds an error's stored message: its extracted message, prefixed with its code when it has one,
 * without null characters, and cut to the most characters allowed, counted by code points.
 * @param error The error.
 * @param maxLength The most characters, the suffix included.
 * @returns The message.
 */
export const buildMessage = (error: unknown, maxLength: number): string => {
  const code = getErrorCode(error);
  const extracted = extractMessage(error);
  const message =
    (code === null ? extracted : `${code}: ${extracted}`).replaceAll('\0', '') || DEFAULT_MESSAGE;
  const codePoints = [...message];
  return codePoints.length <= maxLength
    ? message
    : `${codePoints.slice(0, maxLength - TRUNCATION_SUFFIX.length).join('')}${TRUNCATION_SUFFIX}`;
};

/**
 * Turns an entry into its row. An origin that isn't 1 to 256 characters falls back to the log's,
 * user info that isn't an object and a key that isn't a string are left out, and an Exception's
 * data is stored only when it's an object, redacted, within the payload's bytes.
 * @param entry The entry.
 * @param options The log's origin, redaction, and limits.
 * @returns The row.
 */
export const buildRow = (
  { error, origin, userInfo, deduplicationKey }: IErrorLogEntry,
  options: {
    origin: string;
    redactKeys: readonly string[];
    maxMessageLength: number;
    maxPayloadBytes: number;
  },
): IErrorLogRow => ({
  origin: isBoundedString(origin, 256) ? origin : options.origin,
  error: buildMessage(error, options.maxMessageLength),
  // user info is the caller's own small object, so its size isn't capped
  userInfo: serializeObject(userInfo, Number.POSITIVE_INFINITY),
  payload:
    error instanceof Exception
      ? serializeObject(redactFields(error.data, options.redactKeys), options.maxPayloadBytes)
      : null,
  deduplicationHash: typeof deduplicationKey === 'string' ? hashValue(deduplicationKey) : null,
});
