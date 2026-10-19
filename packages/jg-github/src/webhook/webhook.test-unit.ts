// @vitest-environment node
import { createHmac } from 'node:crypto';

import { ERRORS as CRYPTO_ERRORS } from 'jg-crypto';
import { expectToThrowCode } from 'jg-exception/testing';
import { expect, test } from 'vitest';

import { verifyGithubWebhookSignature } from './webhook.js';

const SECRET = 'webhook-secret';
const BODY = '{"action":"opened","number":42}';

// GitHub's signature of a body: HMAC-SHA256 in lowercase hex, after 'sha256='
const sign = (body: string | Uint8Array, secret = SECRET): string =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

test('accepts the signature of the exact body, as a string or as bytes', () => {
  expect(verifyGithubWebhookSignature(BODY, sign(BODY), SECRET)).toBe(true);
  expect(verifyGithubWebhookSignature(Buffer.from(BODY), sign(BODY), SECRET)).toBe(true);
  expect(verifyGithubWebhookSignature(BODY, sign(BODY), Buffer.from(SECRET))).toBe(true);
});

test.each([
  ['a body changed by one byte', `${BODY} `, sign(BODY)],
  ['another secret', BODY, sign(BODY, 'another-secret')],
  ['an uppercase signature', BODY, sign(BODY).toUpperCase().replace('SHA256=', 'sha256=')],
  ['a signature without its prefix', BODY, sign(BODY).slice('sha256='.length)],
  ['the SHA-1 header', BODY, `sha1=${createHmac('sha1', SECRET).update(BODY).digest('hex')}`],
  ['a signature one character short', BODY, sign(BODY).slice(0, -1)],
  ['a header longer than 71 characters', BODY, `${sign(BODY)}0`],
  ['an empty header', BODY, ''],
  ['a missing header', BODY, undefined],
  ['a repeated header', BODY, [sign(BODY), sign(BODY)]],
  ['a header that is not a string', BODY, 42],
])('refuses %s', (_description, body, header) => {
  expect(verifyGithubWebhookSignature(body, header, SECRET)).toBe(false);
});

test('throws for an empty secret, whatever the header', () => {
  for (const header of [sign(BODY, 'x1'), undefined]) {
    expectToThrowCode(
      () => verifyGithubWebhookSignature(BODY, header, ''),
      CRYPTO_ERRORS.INVALID_HMAC_SECRET,
    );
  }
});
