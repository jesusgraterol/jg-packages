import { Exception } from 'jg-exception';
import { isIntegerValid } from 'jg-utilities';

import { ERRORS, isBoundedString } from '../shared/index.js';
import {
  DIGEST_PATTERN,
  LEASE_ID_PATTERN,
  MAX_DELIVERY_KEY_LENGTH,
  MAX_DELIVERY_SECONDS,
  MAX_DUE_LIMIT,
} from './constants.js';

/**
 * Builds the INVALID_DELIVERY_INBOX_OPTIONS exception.
 * @returns The exception.
 */
export const invalidInboxOptions = (): Exception =>
  new Exception(
    'The delivery inbox needs a table name, a schema, whole lease, retry, and expiry seconds from 1 to 2147483647, and a due-list limit from 1 to 8192.',
    { code: ERRORS.INVALID_DELIVERY_INBOX_OPTIONS },
  );

/**
 * Builds the INVALID_DELIVERY exception.
 * @param cause Why the delivery isn't valid, such as the schema's error.
 * @returns The exception.
 */
export const invalidDelivery = (cause?: unknown): Exception =>
  new Exception(
    'The delivery needs a key of 1 to 512 characters, a lowercase hex SHA-256 digest, a payload its schema accepts, and a lease id that is a UUID.',
    { code: ERRORS.INVALID_DELIVERY, cause },
  );

/**
 * Checks whether a number of seconds is a whole number from 1 to MAX_DELIVERY_SECONDS.
 * @param seconds The seconds.
 * @returns Whether it is.
 */
export const isDeliverySecondsValid = (seconds: unknown): boolean =>
  isIntegerValid(seconds, 1, MAX_DELIVERY_SECONDS);

/**
 * Checks a listDue limit.
 * @param limit The limit.
 * @throws
 * - INVALID_DELIVERY_INBOX_OPTIONS: The delivery inbox needs a table name, a schema, whole lease, retry, and expiry seconds from 1 to 2147483647, and a due-list limit from 1 to 8192.
 */
export const assertDueLimit = (limit: unknown): void => {
  if (!isIntegerValid(limit, 1, MAX_DUE_LIMIT)) {
    throw invalidInboxOptions();
  }
};

/**
 * Checks a delivery's key.
 * @param key The key.
 * @throws
 * - INVALID_DELIVERY: The delivery needs a key of 1 to 512 characters, a lowercase hex SHA-256 digest, a payload its schema accepts, and a lease id that is a UUID.
 */
export const assertDeliveryKey = (key: unknown): void => {
  if (!isBoundedString(key, MAX_DELIVERY_KEY_LENGTH)) {
    throw invalidDelivery();
  }
};

/**
 * Checks a delivery's key and digest.
 * @param key The key.
 * @param digest The digest.
 * @throws
 * - INVALID_DELIVERY: The delivery needs a key of 1 to 512 characters, a lowercase hex SHA-256 digest, a payload its schema accepts, and a lease id that is a UUID.
 */
export const assertKeyAndDigest = (key: unknown, digest: unknown): void => {
  assertDeliveryKey(key);
  if (typeof digest !== 'string' || !DIGEST_PATTERN.test(digest)) {
    throw invalidDelivery();
  }
};

/**
 * Checks a delivery's key and a lease's id.
 * @param key The key.
 * @param leaseId The lease's id.
 * @throws
 * - INVALID_DELIVERY: The delivery needs a key of 1 to 512 characters, a lowercase hex SHA-256 digest, a payload its schema accepts, and a lease id that is a UUID.
 */
export const assertKeyAndLease = (key: unknown, leaseId: unknown): void => {
  assertDeliveryKey(key);
  if (typeof leaseId !== 'string' || !LEASE_ID_PATTERN.test(leaseId)) {
    throw invalidDelivery();
  }
};
