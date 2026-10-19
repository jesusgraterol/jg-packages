import { createPrivateKey, type KeyObject, sign } from 'node:crypto';

import { Exception } from 'jg-exception';

import { ERRORS, invalidArgument } from '../shared/index.js';
import {
  APP_ID_PATTERN,
  JWT_CLOCK_SKEW_SECONDS,
  JWT_LIFETIME_SECONDS,
  PRIVATE_KEY_PEM_PATTERN,
} from './constants.js';
import type { ICreateGithubAppJwtOptions } from './types.js';

/**
 * Builds the exception for a private key that can't sign an App JWT, without the key or the
 * parser's error, which could quote it.
 * @returns The GITHUB_PRIVATE_KEY_INVALID exception.
 */
const privateKeyInvalid = (): Exception =>
  new Exception("The GitHub App's private key isn't an unencrypted RSA private key.", {
    code: ERRORS.GITHUB_PRIVATE_KEY_INVALID,
  });

/**
 * Reads a GitHub App's private key: an unencrypted RSA key, PEM-encoded as PKCS#1 or PKCS#8.
 * @param pem The key.
 * @returns The key.
 * @throws
 * - GITHUB_PRIVATE_KEY_INVALID: The GitHub App's private key isn't an unencrypted RSA private key.
 */
const readPrivateKey = (pem: unknown): KeyObject => {
  const trimmed = typeof pem === 'string' ? pem.trim() : '';
  if (!PRIVATE_KEY_PEM_PATTERN.test(trimmed)) {
    throw privateKeyInvalid();
  }
  let key: KeyObject;
  try {
    key = createPrivateKey({ key: trimmed, format: 'pem' });
  } catch {
    throw privateKeyInvalid();
  }
  if (key.asymmetricKeyType !== 'rsa') {
    throw privateKeyInvalid();
  }
  return key;
};

/**
 * Encodes a value as JSON in base64url, as a JWT's header and payload are.
 * @param value The value.
 * @returns The encoded value.
 */
const encodeJson = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

/**
 * Checks that a GitHub App's private key can sign its JWTs: an unencrypted RSA key, PEM-encoded
 * as PKCS#1, the `RSA PRIVATE KEY` GitHub downloads, or PKCS#8, the `PRIVATE KEY` it converts to.
 * Run it at startup, so a bad key fails before the first request. The error never holds the key.
 * @param pem The key.
 * @example
 * import { assertGithubAppPrivateKey } from 'jg-github';
 *
 * declare const privateKey: string;
 *
 * assertGithubAppPrivateKey(privateKey);
 * @throws
 * - GITHUB_PRIVATE_KEY_INVALID: The GitHub App's private key isn't an unencrypted RSA private key.
 */
export const assertGithubAppPrivateKey = (pem: string): void => {
  readPrivateKey(pem);
};

/**
 * Creates the JWT a GitHub App authenticates as itself with, signed with RS256: issued 60 seconds
 * back, for a GitHub clock behind this one, and expiring 540 seconds ahead, inside GitHub's
 * ten-minute limit even with this clock a minute ahead.
 * @param options The App's ID, its private key, and the time.
 * @returns The JWT.
 * @example
 * import { createGithubAppJwt } from 'jg-github';
 *
 * declare const privateKey: string;
 *
 * const jwt = createGithubAppJwt({ appId: 123456, privateKey });
 * @throws
 * - GITHUB_INVALID_ARGUMENT: An argument isn't valid.
 * - GITHUB_PRIVATE_KEY_INVALID: The GitHub App's private key isn't an unencrypted RSA private key.
 */
export const createGithubAppJwt = ({
  appId,
  privateKey,
  now = new Date(),
}: ICreateGithubAppJwtOptions): string => {
  const issuer = typeof appId === 'number' ? String(appId) : appId;
  if (
    typeof issuer !== 'string' ||
    !APP_ID_PATTERN.test(issuer) ||
    (typeof appId === 'number' && !(Number.isSafeInteger(appId) && appId > 0))
  ) {
    throw invalidArgument('appId');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw invalidArgument('now');
  }
  const key = readPrivateKey(privateKey);
  const seconds = Math.floor(now.getTime() / 1000);
  const unsigned = `${encodeJson({ alg: 'RS256', typ: 'JWT' })}.${encodeJson({
    iat: seconds - JWT_CLOCK_SKEW_SECONDS,
    exp: seconds + JWT_LIFETIME_SECONDS,
    iss: issuer,
  })}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned, 'utf8'), key).toString('base64url')}`;
};
