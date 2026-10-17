import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';
import { parseEnvironment, parseServiceWorkerConfig } from './config.js';
import type { IServiceWorkerConfig } from './schema.js';

// application-specific cache namespace used by valid configuration fixtures
const CACHE_NAME_PREFIX = 'test-app';

// SDK version used by Firebase FCM configuration tests
const FIREBASE_SDK_VERSION = '11.0.0';

// the base template's config
type IBaseConfig = Extract<IServiceWorkerConfig, { template: 'base' }>;

// the firebase-fcm template's config
type IFirebaseFcmConfig = Extract<IServiceWorkerConfig, { template: 'firebase-fcm' }>;

/**
 * Builds a valid base configuration fixture.
 * @param config The configuration fields to override.
 * @returns The complete base configuration fixture.
 */
const buildBaseConfig = (config: Partial<IBaseConfig> = {}): IBaseConfig => ({
  outDir: 'test-dist',
  cacheNamePrefix: CACHE_NAME_PREFIX,
  template: 'base',
  includeToPrecache: ['/', '/index.html', '/style.css', 'app.js'],
  excludeFilesFromPrecache: [],
  excludeMIMETypesFromCache: [],
  ...config,
});

/**
 * Builds a valid Firebase FCM configuration fixture.
 * @param config The configuration fields to override.
 * @returns The complete Firebase FCM configuration fixture.
 */
const buildFirebaseFcmConfig = (config: Partial<IFirebaseFcmConfig> = {}): IFirebaseFcmConfig => ({
  outDir: 'test-dist',
  cacheNamePrefix: CACHE_NAME_PREFIX,
  template: 'firebase-fcm',
  includeToPrecache: ['/', '/index.html', '/style.css', 'app.js'],
  excludeFilesFromPrecache: [],
  excludeMIMETypesFromCache: [],
  firebaseConfigProcessEnvKey: 'JG_SW_TEST_FIREBASE_CONFIG',
  firebaseSdkVersion: FIREBASE_SDK_VERSION,
  ...config,
});

describe('parseServiceWorkerConfig', () => {
  test.each([
    ['missing config object', undefined],
    ['empty outDir', { ...buildBaseConfig(), outDir: '' }],
    ['extra base config field', { ...buildBaseConfig(), firebaseSdkVersion: FIREBASE_SDK_VERSION }],
    ['invalid includeToPrecache', { ...buildBaseConfig(), includeToPrecache: undefined }],
    [
      'invalid excludeFilesFromPrecache',
      { ...buildBaseConfig(), excludeFilesFromPrecache: undefined },
    ],
    [
      'invalid excludeMIMETypesFromCache',
      { ...buildBaseConfig(), excludeMIMETypesFromCache: undefined },
    ],
  ])('parseServiceWorkerConfig(%s) -> FAILED_TO_READ_BASE_CONFIG', (_description, config) => {
    expectToThrowCode(
      () => parseServiceWorkerConfig(config, 'jg-sw.config.json'),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      "The service worker config 'jg-sw.config.json' is invalid:",
    );
  });

  test.each([
    ['missing template', { ...buildBaseConfig(), template: undefined }],
    ['invalid template', { ...buildBaseConfig(), template: 'non-existent' }],
  ])('parseServiceWorkerConfig(%s) -> INVALID_TEMPLATE_NAME', (_description, config) => {
    expectToThrowCode(
      () => parseServiceWorkerConfig(config),
      ERRORS.INVALID_TEMPLATE_NAME,
      "template: Invalid discriminator value. Expected 'base' | 'firebase-fcm'",
    );
  });

  test('can read a valid base config', () => {
    const baseConfig = buildBaseConfig();

    expect(parseServiceWorkerConfig(baseConfig)).toStrictEqual(baseConfig);
  });

  test('accepts an explicit safe cache name prefix', () => {
    const baseConfig = buildBaseConfig({ cacheNamePrefix: 'customer-dashboard' });

    expect(parseServiceWorkerConfig(baseConfig)).toStrictEqual(baseConfig);
  });

  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['uppercase', 'Customer-Dashboard'],
    ['leading-hyphen', '-customer'],
    ['trailing-hyphen', 'customer-'],
    ['repeated-hyphen', 'customer--dashboard'],
  ])('rejects a %s cache name prefix', (_description, cacheNamePrefix) => {
    expectToThrowCode(
      () => parseServiceWorkerConfig({ ...buildBaseConfig(), cacheNamePrefix }),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      'cacheNamePrefix:',
    );
  });

  test.each([
    ['missing cache name prefix', { ...buildFirebaseFcmConfig(), cacheNamePrefix: undefined }],
    [
      'missing Firebase config env key',
      { ...buildFirebaseFcmConfig(), firebaseConfigProcessEnvKey: undefined },
    ],
    [
      'empty Firebase config env key',
      { ...buildFirebaseFcmConfig(), firebaseConfigProcessEnvKey: '' },
    ],
    [
      'missing Firebase SDK version',
      { ...buildFirebaseFcmConfig(), firebaseSdkVersion: undefined },
    ],
    [
      'invalid SDK version and empty outDir',
      { ...buildFirebaseFcmConfig(), firebaseSdkVersion: 'latest', outDir: '' },
    ],
  ])('parseServiceWorkerConfig(%s) -> FAILED_TO_READ_BASE_CONFIG', (_description, config) => {
    expectToThrowCode(() => parseServiceWorkerConfig(config), ERRORS.FAILED_TO_READ_BASE_CONFIG);
  });

  test.each(['', 'latest', '11', '11.0', '11.0.0-beta.1', 'v11.0.0', '11.0.0/../evil'])(
    'rejects the Firebase SDK version %j with INVALID_FIREBASE_SDK_VERSION',
    (firebaseSdkVersion) => {
      expectToThrowCode(
        () => parseServiceWorkerConfig(buildFirebaseFcmConfig({ firebaseSdkVersion })),
        ERRORS.INVALID_FIREBASE_SDK_VERSION,
        'firebaseSdkVersion: The Firebase SDK version must be a version such as 12.4.0.',
      );
    },
  );

  test('can read a valid Firebase FCM config', () => {
    const config = buildFirebaseFcmConfig({ firebaseSdkVersion: '12.4.0' });

    expect(parseServiceWorkerConfig(config)).toStrictEqual(config);
  });
});

describe('parseEnvironment', () => {
  test.each(['development', 'staging', 'production', undefined])('accepts %s', (environment) => {
    expect(parseEnvironment(environment)).toBe(environment);
  });

  test.each(['', 'prod', 'Production', 'toString', 'constructor'])('rejects %j', (environment) => {
    expectToThrowCode(
      () => parseEnvironment(environment),
      ERRORS.INVALID_ENVIRONMENT,
      `The environment '${environment}' isn't supported.`,
    );
  });
});
