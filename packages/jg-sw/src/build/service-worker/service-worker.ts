import { join, resolve } from 'node:path';
import { writeTextFile } from 'jg-fs';
import { generateRandomString } from 'jg-utils';

import { SERVICE_WORKER_FILE_NAME } from '../../shared/index.js';
import {
  parseEnvironment,
  parseServiceWorkerConfig,
  readFirebaseOptions,
  type IServiceWorkerConfig,
} from '../config/index.js';
import { buildPrecacheAssetPaths } from '../precache/index.js';
import {
  CACHE_NAME_CHARACTERS,
  CACHE_NAME_LENGTH,
  CACHE_NAME_SEPARATOR,
  type IBuildServiceWorkerOptions,
} from '../shared/index.js';
import { renderServiceWorker } from '../worker/index.js';

/**
 * Generates the worker and works out the directory it belongs in.
 * @param config The service worker config.
 * @param options The environment, caching, and working directory.
 * @returns A promise that resolves to the worker's source and its output directory.
 */
const generateServiceWorker = async (
  config: IServiceWorkerConfig,
  options: IBuildServiceWorkerOptions,
): Promise<{ source: string; outDir: string }> => {
  const validConfig = parseServiceWorkerConfig(config);
  const environment = parseEnvironment(options.environment);
  const cwd = options.cwd ?? process.cwd();
  const caching = options.caching ?? true;
  const outDir = resolve(cwd, validConfig.outDir);
  const source = await renderServiceWorker({
    template: validConfig.template,
    cacheNamePrefix: validConfig.cacheNamePrefix,
    cacheName: `${validConfig.cacheNamePrefix}${CACHE_NAME_SEPARATOR}${generateRandomString(CACHE_NAME_LENGTH, CACHE_NAME_CHARACTERS)}`,
    precacheAssets: caching
      ? await buildPrecacheAssetPaths(
          outDir,
          validConfig.includeToPrecache,
          validConfig.excludeFilesFromPrecache,
        )
      : [],
    excludeMIMETypes: validConfig.excludeMIMETypesFromCache,
    caching,
    ...(validConfig.template === 'firebase-fcm'
      ? {
          firebase: {
            sdkVersion: validConfig.firebaseSdkVersion,
            options: await readFirebaseOptions(
              validConfig.firebaseConfigProcessEnvKey,
              environment,
              cwd,
            ),
          },
        }
      : {}),
  });
  return { source, outDir };
};

/**
 * Generates the service worker's source from a config, without writing it. Every generated worker
 * gets a new cache name, `<cacheNamePrefix>--<10 random characters>`, so a new deployment
 * replaces the previous one's cache when it activates.
 * @param config The service worker config, as read by readServiceWorkerConfig or written inline.
 * @param options The environment the firebase-fcm template reads its Firebase config from,
 * whether the worker caches (false for development), and the directory paths are resolved from.
 * @returns A promise that resolves to the worker's source.
 * @example
 * const source = await buildServiceWorker(
 *   {
 *     outDir: 'dist',
 *     cacheNamePrefix: 'my-app',
 *     template: 'base',
 *     includeToPrecache: ['/', '/assets'],
 *     excludeFilesFromPrecache: [],
 *     excludeMIMETypesFromCache: ['application/json'],
 *   },
 *   { caching: true },
 * );
 * @throws
 * - FAILED_TO_READ_BASE_CONFIG: The service worker config is invalid.
 * - INVALID_TEMPLATE_NAME: The template must be 'base' or 'firebase-fcm'.
 * - INVALID_FIREBASE_SDK_VERSION: The Firebase SDK version must be a version such as 12.4.0.
 * - INVALID_ENVIRONMENT: The environment isn't supported, or the firebase-fcm template needs one.
 * - NOT_A_PATH_ELEMENT: An asset to precache is outside outDir, or isn't a file or a directory.
 * - FAILED_TO_BUILD_CONFIG: Unable to load the environment file.
 * - INVALID_FIREBASE_CONFIG: The environment variable that holds the Firebase config is missing or
 *   empty.
 * - FAILED_TO_READ_FIREBASE_CONFIG: Unable to read the Firebase config from the environment
 *   variable.
 */
export const buildServiceWorker = async (
  config: IServiceWorkerConfig,
  options: IBuildServiceWorkerOptions = {},
): Promise<string> => (await generateServiceWorker(config, options)).source;

/**
 * Generates the service worker and writes it to `sw.js` in the config's outDir, after the app's
 * build has written its files there.
 * @param config The service worker config, as read by readServiceWorkerConfig or written inline.
 * @param options The environment the firebase-fcm template reads its Firebase config from,
 * whether the worker caches (false for development), and the directory paths are resolved from.
 * @returns A promise that resolves to the written file's path.
 * @example
 * const config = await readServiceWorkerConfig('jg-sw.config.json');
 * await writeServiceWorker(config, { environment: 'production' }); // '/app/dist/sw.js'
 * @throws
 * - FAILED_TO_READ_BASE_CONFIG: The service worker config is invalid.
 * - INVALID_TEMPLATE_NAME: The template must be 'base' or 'firebase-fcm'.
 * - INVALID_FIREBASE_SDK_VERSION: The Firebase SDK version must be a version such as 12.4.0.
 * - INVALID_ENVIRONMENT: The environment isn't supported, or the firebase-fcm template needs one.
 * - NOT_A_PATH_ELEMENT: An asset to precache is outside outDir, or isn't a file or a directory.
 * - FAILED_TO_BUILD_CONFIG: Unable to load the environment file.
 * - INVALID_FIREBASE_CONFIG: The environment variable that holds the Firebase config is missing or
 *   empty.
 * - FAILED_TO_READ_FIREBASE_CONFIG: Unable to read the Firebase config from the environment
 *   variable.
 */
export const writeServiceWorker = async (
  config: IServiceWorkerConfig,
  options: IBuildServiceWorkerOptions = {},
): Promise<string> => {
  const { source, outDir } = await generateServiceWorker(config, options);
  const path = join(outDir, SERVICE_WORKER_FILE_NAME);
  await writeTextFile(path, source);
  return path;
};
