import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { readFirebaseOptions } from './firebase.js';
import type { IFirebaseOptions } from './schema.js';

// Firebase options the environment files hold
const FIREBASE_OPTIONS: IFirebaseOptions = {
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  projectId: 'test-project',
  storageBucket: 'test.firebasestorage.app',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:test-app',
};

let directory: string;

// the variables each test reads, unique per test so loading an environment file can't leak
// values between tests
let envKey: string;
let otherKey: string;

/**
 * Builds the value of the Firebase config variable.
 * @param options The Firebase options to override.
 * @returns The JSON value.
 */
const firebaseConfig = (options: Partial<IFirebaseOptions> = {}): string =>
  JSON.stringify({ options: { ...FIREBASE_OPTIONS, ...options } });

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-sw-firebase-'));
  const suffix = randomUUID().replaceAll('-', '_').toUpperCase();
  envKey = `JG_SW_TEST_FIREBASE_${suffix}`;
  otherKey = `JG_SW_TEST_OTHER_${suffix}`;
});

afterEach(async () => {
  delete process.env[envKey];
  delete process.env[otherKey];
  await rm(directory, { recursive: true, force: true });
});

describe('readFirebaseOptions', () => {
  test.each([
    ['development', '.env'],
    ['staging', '.env.staging'],
    ['production', '.env.production'],
  ] as const)('reads the %s environment from %s', async (environment, fileName) => {
    for (const name of ['.env', '.env.staging', '.env.production']) {
      await writeFile(
        join(directory, name),
        `${envKey}='${firebaseConfig({ projectId: name })}'\n`,
      );
    }

    await expect(readFirebaseOptions(envKey, environment, directory)).resolves.toStrictEqual({
      ...FIREBASE_OPTIONS,
      projectId: fileName,
    });
  });

  test('keeps the values already set in the environment over the file', async () => {
    process.env[envKey] = firebaseConfig({ projectId: 'from-the-shell' });
    await writeFile(
      join(directory, '.env.production'),
      `${envKey}='${firebaseConfig({ projectId: 'from-the-file' })}'\n${otherKey}=from-the-file\n`,
    );

    await expect(readFirebaseOptions(envKey, 'production', directory)).resolves.toStrictEqual({
      ...FIREBASE_OPTIONS,
      projectId: 'from-the-shell',
    });
    expect(process.env[otherKey]).toBe('from-the-file');
  });

  test('reads the environment alone when the environment file is missing', async () => {
    process.env[envKey] = firebaseConfig();

    await expect(readFirebaseOptions(envKey, 'staging', directory)).resolves.toStrictEqual(
      FIREBASE_OPTIONS,
    );
  });

  test('throws INVALID_ENVIRONMENT without an environment', async () => {
    process.env[envKey] = firebaseConfig();

    await expectToRejectCode(
      readFirebaseOptions(envKey, undefined, directory),
      ERRORS.INVALID_ENVIRONMENT,
      'The firebase-fcm template needs an environment',
    );
  });

  test('throws INVALID_FIREBASE_CONFIG when the variable is missing or empty', async () => {
    await expectToRejectCode(
      readFirebaseOptions(envKey, 'production', directory),
      ERRORS.INVALID_FIREBASE_CONFIG,
      `The environment variable '${envKey}' that holds the Firebase config is missing or empty.`,
    );

    process.env[envKey] = '  ';
    await expectToRejectCode(
      readFirebaseOptions(envKey, 'production', directory),
      ERRORS.INVALID_FIREBASE_CONFIG,
    );
  });

  test.each([
    ['invalid JSON', 'invalid-json'],
    ['a config without options', JSON.stringify({ apiKey: 'test-api-key' })],
    ['options missing a field', JSON.stringify({ options: { apiKey: 'test-api-key' } })],
  ])('throws FAILED_TO_READ_FIREBASE_CONFIG for %s', async (_description, value) => {
    process.env[envKey] = value;

    await expectToRejectCode(
      readFirebaseOptions(envKey, 'production', directory),
      ERRORS.FAILED_TO_READ_FIREBASE_CONFIG,
      `Unable to read the Firebase config from the environment variable '${envKey}':`,
    );
  });

  test('throws FAILED_TO_BUILD_CONFIG when the environment file cannot be loaded', async () => {
    await mkdir(join(directory, '.env'));

    await expectToRejectCode(
      readFirebaseOptions(envKey, 'development', directory),
      ERRORS.FAILED_TO_BUILD_CONFIG,
      `Unable to load the environment file '${join(directory, '.env')}'`,
    );
  });
});
