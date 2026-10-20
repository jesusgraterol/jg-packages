import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { IServiceWorkerConfig } from '../config/index.js';
import { ERRORS } from '../shared/index.js';
import { buildServiceWorker, writeServiceWorker } from './service-worker.js';

let directory: string;
let envKey: string;

/**
 * Builds a base config whose outDir is `dist` inside the test's directory.
 * @param config The fields to override.
 * @returns The config.
 */
const baseConfig = (config: Partial<IServiceWorkerConfig> = {}): IServiceWorkerConfig =>
  ({
    outDir: 'dist',
    cacheNamePrefix: 'test-app',
    template: 'base',
    includeToPrecache: ['/assets'],
    excludeFilesFromPrecache: [],
    excludeMIMETypesFromCache: [],
    ...config,
  }) as IServiceWorkerConfig;

/**
 * Reads a generated worker's constant by running the worker in a fresh context.
 * @param source The worker's source.
 * @param name The constant's name.
 * @returns The constant's value, copied into this realm.
 */
const readConstant = (source: string, name: string): unknown => {
  const context = createContext({
    URL,
    self: { addEventListener: vi.fn(), location: { origin: 'https://example.com' } },
    importScripts: vi.fn(),
    firebase: { initializeApp: vi.fn(), messaging: () => ({ onBackgroundMessage: vi.fn() }) },
  });
  runInContext(source, context);
  return JSON.parse(runInContext(`JSON.stringify(${name})`, context) as string);
};

/**
 * Writes the app's build output into dist.
 * @returns A promise that resolves once the files are written.
 */
const writeBuild = async (): Promise<void> => {
  await mkdir(join(directory, 'dist', 'assets'), { recursive: true });
  await writeFile(join(directory, 'dist', 'index.html'), 'Test Index File');
  await writeFile(join(directory, 'dist', 'assets', 'index-B3okp6nu.js'), 'Test JS File');
  await writeFile(join(directory, 'dist', 'assets', 'index-DYWPQKGv.css'), 'Test CSS File');
};

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'jg-sw-generate-'));
  envKey = `JG_SW_TEST_FIREBASE_${randomUUID().replaceAll('-', '_').toUpperCase()}`;
});

afterEach(async () => {
  delete process.env[envKey];
  await rm(directory, { recursive: true, force: true });
});

describe('writeServiceWorker', () => {
  test('can build the Service Worker Base Template', async () => {
    await writeBuild();

    const path = await writeServiceWorker(baseConfig(), { cwd: directory });

    expect(path).toBe(join(directory, 'dist', 'sw.js'));
    const source = await readFile(path, 'utf8');
    expect(readConstant(source, 'CACHE_NAME_PREFIX')).toBe('test-app');
    expect(readConstant(source, 'CACHE_NAME')).toMatch(/^test-app--[a-z0-9]{10}$/);
    expect(readConstant(source, 'CACHING')).toBe(true);
    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([
      '/assets/index-B3okp6nu.js',
      '/assets/index-DYWPQKGv.css',
    ]);
  });

  test('generates a different cache name every time', async () => {
    await writeBuild();
    const sources = await Promise.all(
      [1, 2, 3].map(() => buildServiceWorker(baseConfig(), { cwd: directory })),
    );

    const cacheNames = sources.map((source) => readConstant(source, 'CACHE_NAME'));
    expect(new Set(cacheNames).size).toBe(cacheNames.length);
  });

  test('builds the worker for the firebase-fcm template from the environment file', async () => {
    await writeBuild();
    const options = {
      apiKey: 'test-api-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test.firebasestorage.app',
      messagingSenderId: '123456789',
      appId: '1:123456789:web:test-app',
    };
    await writeFile(
      join(directory, '.env.production'),
      `${envKey}='${JSON.stringify({ options })}'\n`,
    );
    const config = baseConfig({
      template: 'firebase-fcm',
      firebaseConfigProcessEnvKey: envKey,
      firebaseSdkVersion: '12.4.0',
    });

    const source = await readFile(
      await writeServiceWorker(config, { cwd: directory, environment: 'production' }),
      'utf8',
    );

    expect(readConstant(source, 'FIREBASE_SDK_VERSION')).toBe('12.4.0');
    expect(readConstant(source, 'FIREBASE_OPTIONS')).toStrictEqual(options);
    await expectToRejectCode(
      buildServiceWorker(config, { cwd: directory }),
      ERRORS.INVALID_ENVIRONMENT,
    );
  });
});

describe('buildServiceWorker', () => {
  test('without caching, reads no build output and precaches nothing', async () => {
    const source = await buildServiceWorker(baseConfig({ outDir: 'missing' }), {
      cwd: directory,
      caching: false,
    });

    expect(readConstant(source, 'CACHING')).toBe(false);
    expect(readConstant(source, 'PRECACHE_ASSETS')).toStrictEqual([]);
  });

  test('without caching, names the cache <prefix>--development, so the worker is the same each time', async () => {
    const sources = await Promise.all(
      [1, 2].map(() => buildServiceWorker(baseConfig(), { cwd: directory, caching: false })),
    );

    expect(readConstant(sources[0] as string, 'CACHE_NAME')).toBe('test-app--development');
    expect(sources[1]).toBe(sources[0]);
  });

  test('resolves outDir from the current directory without a cwd', async () => {
    const source = await buildServiceWorker(baseConfig({ outDir: 'missing' }), {
      caching: false,
    });

    expect(readConstant(source, 'CACHING')).toBe(false);
  });

  test('validates the config and the options it receives', async () => {
    await writeBuild();

    await expectToRejectCode(
      buildServiceWorker(baseConfig({ cacheNamePrefix: 'Bad Prefix' }), { cwd: directory }),
      ERRORS.FAILED_TO_READ_BASE_CONFIG,
      'The service worker config is invalid: cacheNamePrefix:',
    );
    await expectToRejectCode(
      buildServiceWorker(baseConfig(), {
        cwd: directory,
        environment: 'prod' as 'production',
      }),
      ERRORS.INVALID_ENVIRONMENT,
    );
    await expectToRejectCode(
      buildServiceWorker(baseConfig({ includeToPrecache: ['/missing.js'] }), { cwd: directory }),
      ERRORS.NOT_A_PATH_ELEMENT,
    );
  });

  test('writes a precached navigation fallback into the worker', async () => {
    await writeBuild();

    const source = await buildServiceWorker(
      baseConfig({ includeToPrecache: ['/', '/index.html'], navigationFallback: '/index.html' }),
      { cwd: directory },
    );

    expect(readConstant(source, 'NAVIGATION_FALLBACK')).toBe('/index.html');
    expect(
      readConstant(
        await buildServiceWorker(baseConfig(), { cwd: directory }),
        'NAVIGATION_FALLBACK',
      ),
    ).toBeNull();
  });

  test('rejects a navigation fallback the worker does not precache, unless it caches nothing', async () => {
    await writeBuild();

    await expectToRejectCode(
      buildServiceWorker(baseConfig({ navigationFallback: '/index.html' }), { cwd: directory }),
      ERRORS.NAVIGATION_FALLBACK_NOT_PRECACHED,
      "The navigation fallback '/index.html' isn't precached.",
    );
    const source = await buildServiceWorker(
      baseConfig({ outDir: 'missing', navigationFallback: '/index.html' }),
      { cwd: directory, caching: false },
    );
    expect(readConstant(source, 'NAVIGATION_FALLBACK')).toBe('/index.html');
  });
});
