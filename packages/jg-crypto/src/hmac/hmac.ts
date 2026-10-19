import { timingSafeEqual } from 'node:crypto';

import type { IHmacOptions } from '../shared/index.js';

import { computeHmac, SIGNATURE_PATTERN } from './utilities.js';

/**
 * Signs a message with HMAC-SHA256 and returns the signature in lowercase hex, 64 characters.
 *
 * Without a `domain`, it's the plain HMAC webhook providers compute, such as GitHub's
 * `X-Hub-Signature-256` without its `sha256=` prefix. With one, the key is derived from the secret
 * and the domain, so the same secret can sign several kinds of values without a signature for one
 * kind ever verifying for another.
 * @param message The string or bytes to sign. A string is signed as its UTF-8 bytes, so sign a
 * request's raw body as bytes rather than as text it was decoded to.
 * @param secret The secret, a non-empty string or byte array.
 * @param options The domain the signature is for, if any.
 * @returns The signature, in lowercase hex.
 * @example
 * import { signHmac } from 'jg-crypto';
 *
 * const signature = signHmac('{"page":2}', secret, { domain: 'cursor' }); // 64 hex characters
 * @throws
 * - INVALID_HMAC_SECRET: The HMAC secret must be a non-empty string or byte array.
 * - INVALID_HMAC_DOMAIN: The HMAC domain must be a non-empty string when it's given.
 */
export const signHmac = (
  message: string | Uint8Array,
  secret: string | Uint8Array,
  options: IHmacOptions = {},
): string => computeHmac(message, secret, options).toString('hex');

/**
 * Checks a signature from `signHmac`, or from a webhook provider, comparing it in constant time so
 * the time taken reveals nothing about how much of it matched.
 *
 * It returns false for anything but the exact signature: a different message, secret, or domain, an
 * uppercase or truncated signature, or one that isn't hex. It never throws for a bad signature,
 * because signatures come from outside the program, only for an invalid secret or domain, which are
 * the program's own.
 * @param message The string or bytes that were signed.
 * @param signature The signature to check, 64 lowercase hex characters.
 * @param secret The secret, a non-empty string or byte array.
 * @param options The domain the signature is for, if any.
 * @returns Whether the signature is valid for the message.
 * @example
 * import { verifyHmac } from 'jg-crypto';
 *
 * const isAuthentic = verifyHmac(rawBody, signatureHeader.replace(/^sha256=/, ''), webhookSecret);
 * @throws
 * - INVALID_HMAC_SECRET: The HMAC secret must be a non-empty string or byte array.
 * - INVALID_HMAC_DOMAIN: The HMAC domain must be a non-empty string when it's given.
 */
export const verifyHmac = (
  message: string | Uint8Array,
  signature: string,
  secret: string | Uint8Array,
  options: IHmacOptions = {},
): boolean => {
  const expected = computeHmac(message, secret, options);
  if (typeof signature !== 'string' || !SIGNATURE_PATTERN.test(signature)) {
    return false;
  }
  return timingSafeEqual(Buffer.from(signature, 'hex'), expected);
};
