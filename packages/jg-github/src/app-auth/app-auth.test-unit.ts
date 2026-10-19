// @vitest-environment node
import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';

import { expectToThrowCode } from 'jg-exception/testing';
import { beforeAll, describe, expect, test } from 'vitest';

import { catchError, expectNoValue } from '../shared/leak.test-utils.js';
import { ERRORS } from '../shared/index.js';

import { assertGithubAppPrivateKey, createGithubAppJwt } from './app-auth.js';

// the time the JWTs in these tests are issued at, in milliseconds
const NOW_MS = 1_800_000_000_000;

/**
 * Decodes one base64url part of a JWT as JSON.
 * @param part The part.
 * @returns The value.
 */
const decodePart = (part: string | undefined): unknown =>
  JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8'));

describe('GitHub App authentication', () => {
  // a key generated for these tests, never committed
  let pkcs1: string;
  let pkcs8: string;

  beforeAll(() => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  });

  test('signs a JWT issued 60 seconds back and expiring 540 seconds ahead, with RS256', () => {
    const jwt = createGithubAppJwt({ appId: 123456, privateKey: pkcs1, now: new Date(NOW_MS) });
    const [header, payload, signature] = jwt.split('.');

    expect(decodePart(header)).toStrictEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decodePart(payload)).toStrictEqual({
      iat: 1_799_999_940,
      exp: 1_800_000_540,
      iss: '123456',
    });
    expect(
      verify(
        'RSA-SHA256',
        Buffer.from(`${header}.${payload}`),
        createPublicKey(pkcs1),
        Buffer.from(signature ?? '', 'base64url'),
      ),
    ).toBe(true);
  });

  test('rounds the time down to whole seconds, and takes a client ID as the issuer', () => {
    const jwt = createGithubAppJwt({
      appId: 'Iv23liAbCdEf0123',
      privateKey: pkcs8,
      now: new Date(NOW_MS + 999),
    });

    expect(decodePart(jwt.split('.')[1])).toStrictEqual({
      iat: 1_799_999_940,
      exp: 1_800_000_540,
      iss: 'Iv23liAbCdEf0123',
    });
  });

  test('issues the JWT now by default', () => {
    const before = Math.floor(Date.now() / 1000);
    const { iat } = decodePart(
      createGithubAppJwt({ appId: 1, privateKey: pkcs1 }).split('.')[1],
    ) as { iat: number };

    expect(iat).toBeGreaterThanOrEqual(before - 60);
    expect(iat).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) - 60);
  });

  test('accepts a PKCS#1 or a PKCS#8 RSA key, with leading whitespace', () => {
    expect(() => {
      assertGithubAppPrivateKey(pkcs1);
      assertGithubAppPrivateKey(pkcs8);
      assertGithubAppPrivateKey(`\n  ${pkcs1}`);
    }).not.toThrow();
  });

  test.each([
    [
      'an EC key',
      () =>
        generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString(),
    ],
    [
      'an Ed25519 key',
      () =>
        generateKeyPairSync('ed25519')
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString(),
    ],
    [
      'an RSA-PSS key',
      () =>
        generateKeyPairSync('rsa-pss', { modulusLength: 2048 })
          .privateKey.export({ type: 'pkcs8', format: 'pem' })
          .toString(),
    ],
    [
      'an encrypted key',
      () =>
        generateKeyPairSync('rsa', { modulusLength: 2048 })
          .privateKey.export({
            type: 'pkcs8',
            format: 'pem',
            cipher: 'aes-256-cbc',
            passphrase: 'passphrase',
          })
          .toString(),
    ],
    [
      'a public key',
      () =>
        generateKeyPairSync('rsa', { modulusLength: 2048 })
          .publicKey.export({ type: 'spki', format: 'pem' })
          .toString(),
    ],
    ['a truncated key', () => pkcs1.slice(0, 200)],
    ['a key without its PEM label', () => pkcs1.split('\n').slice(1, -2).join('\n')],
    ['a value that is not a string', () => 42 as unknown as string],
  ])('refuses %s, without the key in the error', (_description, buildKey) => {
    const key = buildKey();
    const error = catchError(() => assertGithubAppPrivateKey(key));

    expect(error).toMatchObject({ code: ERRORS.GITHUB_PRIVATE_KEY_INVALID });
    expect((error as Error).cause).toBeUndefined();
    if (typeof key === 'string' && key.length > 100) {
      expectNoValue(error, key.split('\n')[2] ?? key);
    }
    expectToThrowCode(
      () => createGithubAppJwt({ appId: 1, privateKey: key }),
      ERRORS.GITHUB_PRIVATE_KEY_INVALID,
    );
  });

  test.each([
    ['an app ID of 0', { appId: 0 }],
    ['a negative app ID', { appId: -1 }],
    ['a fractional app ID', { appId: 1.5 }],
    ['an empty client ID', { appId: '' }],
    ['a client ID with a space', { appId: 'Iv1 abc' }],
    ['an app ID that is not a string or a number', { appId: null }],
    ['a time that is not a date', { now: '2026-10-19' }],
    ['an invalid date', { now: new Date(Number.NaN) }],
  ])('rejects %s', (_description, overrides) => {
    expectToThrowCode(
      () =>
        createGithubAppJwt({ appId: 1, privateKey: pkcs1, ...overrides } as Parameters<
          typeof createGithubAppJwt
        >[0]),
      ERRORS.GITHUB_INVALID_ARGUMENT,
    );
  });
});
