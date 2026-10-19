import { createHash } from 'node:crypto';
import { Exception } from 'jg-exception';

import { ERRORS, type IHashAlgorithm } from '../shared/index.js';

// the algorithms hashValue accepts, checked at runtime for callers without types
const HASH_ALGORITHMS: readonly unknown[] = [
  'sha256',
  'sha384',
  'sha512',
] satisfies IHashAlgorithm[];

/**
 * Hashes a value with SHA-256, or another SHA-2 algorithm, and returns the lowercase hex digest. A
 * string is hashed as its UTF-8 bytes, so a string and its encoded bytes give the same digest.
 *
 * Use it to store a token's hash instead of the token, or to compare values without keeping them.
 * It's a plain digest, not a password hash: don't use it for passwords, which need a slow,
 * salted function such as scrypt.
 * @param value The string or bytes to hash.
 * @param algorithm The SHA-2 algorithm.
 * @returns The digest, in lowercase hex: 64 characters for SHA-256.
 * @example
 * import { hashValue } from 'jg-crypto';
 *
 * hashValue('abc'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 * hashValue('abc', 'sha512'); // a 128-character digest
 * @throws
 * - UNSUPPORTED_HASH_ALGORITHM: The hash algorithm must be sha256, sha384, or sha512.
 */
export const hashValue = (
  value: string | Uint8Array,
  algorithm: IHashAlgorithm = 'sha256',
): string => {
  if (!HASH_ALGORITHMS.includes(algorithm)) {
    throw new Exception('The hash algorithm must be sha256, sha384, or sha512.', {
      code: ERRORS.UNSUPPORTED_HASH_ALGORITHM,
      data: { algorithm: String(algorithm) },
    });
  }
  return createHash(algorithm).update(value).digest('hex');
};
