import { verifyHmac } from 'jg-crypto';

import { MAX_SIGNATURE_HEADER_LENGTH, SIGNATURE_HEADER_PATTERN } from './constants.js';

/**
 * Verifies a GitHub webhook delivery's X-Hub-Signature-256 header against the body's exact
 * bytes, in constant time. A header that's missing, repeated, longer than 71 characters, or not
 * `sha256=` and 64 lowercase hexadecimal characters is false, like a wrong signature. Verify the
 * raw body before parsing it, because parsing and serializing can change its bytes.
 * @param rawBody The request's body, as received.
 * @param header The X-Hub-Signature-256 header, as the framework gives it.
 * @param secret The webhook's secret.
 * @returns Whether the signature is the body's.
 * @example
 * import { verifyGithubWebhookSignature } from 'jg-github';
 *
 * declare const rawBody: Buffer;
 * declare const headers: Record<string, string | string[] | undefined>;
 * declare const webhookSecret: string;
 *
 * if (!verifyGithubWebhookSignature(rawBody, headers['x-hub-signature-256'], webhookSecret)) {
 *   // answer 401
 * }
 * @throws
 * - INVALID_HMAC_SECRET: The HMAC secret must be a non-empty string or byte array.
 */
export const verifyGithubWebhookSignature = (
  rawBody: string | Uint8Array,
  header: unknown,
  secret: string | Uint8Array,
): boolean => {
  if (
    typeof header !== 'string' ||
    header.length > MAX_SIGNATURE_HEADER_LENGTH ||
    !SIGNATURE_HEADER_PATTERN.test(header)
  ) {
    // still checks the secret, so an empty one fails loudly whatever the header
    verifyHmac(rawBody, '', secret);
    return false;
  }
  return verifyHmac(rawBody, header.slice('sha256='.length), secret);
};
