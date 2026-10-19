import { createHmac } from 'node:crypto';
import { Exception } from 'jg-exception';

import { ERRORS, type IHmacOptions } from '../shared/index.js';

// the only signature verifyHmac accepts: an HMAC-SHA256 digest in lowercase hex
export const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Computes the HMAC-SHA256 of a message, with a key derived from the domain when there is one.
 * Validates the secret and the domain first, so a configuration mistake throws even when the
 * signature being verified is malformed.
 * @param message The string or bytes to sign. A string is signed as its UTF-8 bytes.
 * @param secret The secret, a non-empty string or byte array.
 * @param options The domain, if any.
 * @returns The 32-byte digest.
 * @throws
 * - INVALID_HMAC_SECRET: The HMAC secret must be a non-empty string or byte array.
 * - INVALID_HMAC_DOMAIN: The HMAC domain must be a non-empty string when it's given.
 */
export const computeHmac = (
  message: string | Uint8Array,
  secret: string | Uint8Array,
  { domain }: IHmacOptions,
): Buffer => {
  const isSecretValid =
    typeof secret === 'string'
      ? secret.length > 0
      : secret instanceof Uint8Array && secret.length > 0;
  if (!isSecretValid) {
    throw new Exception('The HMAC secret must be a non-empty string or byte array.', {
      code: ERRORS.INVALID_HMAC_SECRET,
    });
  }
  if (domain !== undefined && (typeof domain !== 'string' || domain.length === 0)) {
    throw new Exception("The HMAC domain must be a non-empty string when it's given.", {
      code: ERRORS.INVALID_HMAC_DOMAIN,
    });
  }
  const key = domain === undefined ? secret : createHmac('sha256', secret).update(domain).digest();
  return createHmac('sha256', key).update(message).digest();
};
