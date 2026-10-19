// @vitest-environment node
import { createHmac } from 'node:crypto';
import fc from 'fast-check';
import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import { signHmac, verifyHmac } from './hmac.js';

// the example in GitHub's "Validating webhook deliveries" documentation
const GITHUB_SECRET = "It's a Secret to Everybody";
const GITHUB_PAYLOAD = 'Hello, World!';
const GITHUB_SIGNATURE = '757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';

describe('signHmac', () => {
  test('matches RFC 4231 test case 2', () => {
    expect(signHmac('what do ya want for nothing?', 'Jefe')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });

  test("matches GitHub's documented webhook signature", () => {
    expect(signHmac(GITHUB_PAYLOAD, GITHUB_SECRET)).toBe(GITHUB_SIGNATURE);
    expect(signHmac(Buffer.from(GITHUB_PAYLOAD), Buffer.from(GITHUB_SECRET))).toBe(
      GITHUB_SIGNATURE,
    );
  });

  test('signs with HMAC-SHA256(secret, domain) as the key when a domain is given', () => {
    const key = createHmac('sha256', 'secret').update('cursor').digest();
    const expected = createHmac('sha256', key).update('{"page":2}').digest('hex');

    expect(signHmac('{"page":2}', 'secret', { domain: 'cursor' })).toBe(expected);
    expect(signHmac('{"page":2}', 'secret', { domain: 'checkpoint' })).not.toBe(expected);
    expect(signHmac('{"page":2}', 'secret')).not.toBe(expected);
  });

  test('signs bytes that are not UTF-8 as they are, not as the text they decode to', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41]);

    expect(signHmac(bytes, 'secret')).not.toBe(
      signHmac(Buffer.from(bytes).toString('utf8'), 'secret'),
    );
  });
});

describe('verifyHmac', () => {
  const signature = signHmac('message', 'secret', { domain: 'cursor' });

  test('accepts the signature of the message', () => {
    expect(verifyHmac('message', signature, 'secret', { domain: 'cursor' })).toBe(true);
    expect(verifyHmac(GITHUB_PAYLOAD, GITHUB_SIGNATURE, GITHUB_SECRET)).toBe(true);
  });

  test.each([
    ['another message', 'message!', signature, 'secret', 'cursor'],
    ['another secret', 'message', signature, 'other secret', 'cursor'],
    ['another domain', 'message', signature, 'secret', 'checkpoint'],
    ['no domain', 'message', signature, 'secret', undefined],
    ['uppercase hex', 'message', signature.toUpperCase(), 'secret', 'cursor'],
    ['a truncated signature', 'message', signature.slice(0, 63), 'secret', 'cursor'],
    ['a longer signature', 'message', `${signature}0`, 'secret', 'cursor'],
    ['a signature that is not hex', 'message', 'z'.repeat(64), 'secret', 'cursor'],
    ['a prefixed signature', 'message', `sha256=${signature}`, 'secret', 'cursor'],
    ['an empty signature', 'message', '', 'secret', 'cursor'],
  ])('rejects %s', (_, message, candidate, secret, domain) => {
    expect(verifyHmac(message, candidate, secret, { domain })).toBe(false);
  });

  test.each([42, null, undefined, Buffer.from(signature, 'hex')])(
    'rejects a signature that is not a string, %o',
    (candidate) => {
      expect(
        verifyHmac('message', candidate as unknown as string, 'secret', { domain: 'cursor' }),
      ).toBe(false);
    },
  );

  test('never throws for a signature, and accepts only the right one', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        fc.oneof(fc.string(), fc.stringMatching(/^[0-9a-f]{64}$/)),
        (message, secret, candidate) => {
          const expected = signHmac(message, secret);

          expect(verifyHmac(message, expected, secret)).toBe(true);
          expect(verifyHmac(message, candidate, secret)).toBe(candidate === expected);
        },
      ),
    );
  });
});

describe('secret and domain validation', () => {
  test.each([
    ['an empty string', ''],
    ['an empty byte array', new Uint8Array(0)],
    ['a number', 42],
  ])('rejects %s as the secret', (_, secret) => {
    const message = 'The HMAC secret must be a non-empty string or byte array.';

    expectToThrowCode(
      () => signHmac('message', secret as string),
      ERRORS.INVALID_HMAC_SECRET,
      message,
    );
    expectToThrowCode(
      () => verifyHmac('message', 'not a signature', secret as string),
      ERRORS.INVALID_HMAC_SECRET,
      message,
    );
  });

  test.each([
    ['an empty string', ''],
    ['a number', 42],
  ])('rejects %s as the domain', (_, domain) => {
    const message = "The HMAC domain must be a non-empty string when it's given.";

    expectToThrowCode(
      () => signHmac('message', 'secret', { domain: domain as string }),
      ERRORS.INVALID_HMAC_DOMAIN,
      message,
    );
    expectToThrowCode(
      () => verifyHmac('message', 'not a signature', 'secret', { domain: domain as string }),
      ERRORS.INVALID_HMAC_DOMAIN,
      message,
    );
  });
});
