import { randomBytes, randomInt } from 'node:crypto';
import { Exception } from 'jg-exception';

import { ERRORS, type IRandomBytesEncoding } from '../shared/index.js';

import {
  MAX_RANDOM_BYTE_LENGTH,
  MAX_RANDOM_DIGIT_COUNT,
  RANDOM_BYTES_ENCODINGS,
} from './constants.js';

/**
 * Generates cryptographically secure random bytes, encoded as text, such as an opaque token for a
 * link or a session. 32 bytes give 256 bits: 43 base64url characters or 64 hex characters.
 * @param byteLength How many random bytes to generate, an integer from 1 to 65536.
 * @param encoding How to encode them.
 * @returns The encoded bytes.
 * @example
 * import { generateRandomBytes } from 'jg-crypto';
 *
 * generateRandomBytes(32); // 43 base64url characters, such as 'q3Rz…'
 * generateRandomBytes(16, 'hex'); // 32 hex characters
 * @throws
 * - INVALID_BYTE_LENGTH: The byte length must be an integer from 1 to 65536.
 * - UNSUPPORTED_ENCODING: The encoding must be base64url or hex.
 */
export const generateRandomBytes = (
  byteLength: number,
  encoding: IRandomBytesEncoding = 'base64url',
): string => {
  if (!Number.isInteger(byteLength) || byteLength < 1 || byteLength > MAX_RANDOM_BYTE_LENGTH) {
    throw new Exception('The byte length must be an integer from 1 to 65536.', {
      code: ERRORS.INVALID_BYTE_LENGTH,
      data: { byteLength: String(byteLength) },
    });
  }
  if (!RANDOM_BYTES_ENCODINGS.includes(encoding)) {
    throw new Exception('The encoding must be base64url or hex.', {
      code: ERRORS.UNSUPPORTED_ENCODING,
      data: { encoding: String(encoding) },
    });
  }
  return randomBytes(byteLength).toString(encoding);
};

/**
 * Generates a string of cryptographically secure random digits, such as a one-time code to send by
 * email. Every digit is drawn uniformly from 0 to 9, so leading zeros are as likely as any other
 * digit and are kept.
 * @param count How many digits to generate, an integer from 1 to 256.
 * @returns The digits.
 * @example
 * import { generateRandomDigits } from 'jg-crypto';
 *
 * generateRandomDigits(6); // such as '042917'
 * @throws
 * - INVALID_DIGIT_COUNT: The digit count must be an integer from 1 to 256.
 */
export const generateRandomDigits = (count: number): string => {
  if (!Number.isInteger(count) || count < 1 || count > MAX_RANDOM_DIGIT_COUNT) {
    throw new Exception('The digit count must be an integer from 1 to 256.', {
      code: ERRORS.INVALID_DIGIT_COUNT,
      data: { count: String(count) },
    });
  }
  let digits = '';
  for (let index = 0; index < count; index += 1) {
    digits += String(randomInt(10));
  }
  return digits;
};
