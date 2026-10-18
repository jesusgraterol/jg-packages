import { z } from 'zod';

import { CACHE_NAME_PREFIX_PATTERN, FIREBASE_SDK_VERSION_PATTERN } from '../shared/index.js';

// the fields every template shares
const BaseConfigShape = {
  // the directory the app's build is written to, where the worker is written too
  outDir: z.string().min(1),

  // the application-owned namespace the worker's caches are named in, such as 'my-app'
  cacheNamePrefix: z
    .string()
    .regex(
      CACHE_NAME_PREFIX_PATTERN,
      'The cache name prefix must contain lowercase alphanumeric tokens separated by hyphens.',
    ),

  // the files and directories, relative to outDir, the worker caches when it installs
  includeToPrecache: z.array(z.string()),

  // the file names left out of precaching, wherever they are
  excludeFilesFromPrecache: z.array(z.string()),

  // the MIME types whose responses the worker never caches, such as 'application/json'
  excludeMIMETypesFromCache: z.array(z.string()),

  // the precached page that answers a navigation the worker can neither find in its cache nor
  // fetch, such as '/index.html' for a single-page app offline. Without it, such a navigation gets
  // the worker's network error
  navigationFallback: z
    .string()
    .startsWith('/', 'The navigation fallback must be a path such as /index.html.')
    .optional(),
};

// the config of a worker that caches the app
const BaseConfigSchema = z.strictObject({
  ...BaseConfigShape,
  template: z.literal('base'),
});

// the config of a worker that caches the app and shows Firebase Cloud Messaging notifications
const FirebaseFcmConfigSchema = z.strictObject({
  ...BaseConfigShape,
  template: z.literal('firebase-fcm'),

  // the environment variable holding the Firebase config, as JSON: { "options": { … } }
  firebaseConfigProcessEnvKey: z.string().min(1),

  // the Firebase JavaScript SDK version the worker loads, such as '12.4.0'
  firebaseSdkVersion: z
    .string()
    .regex(
      FIREBASE_SDK_VERSION_PATTERN,
      'The Firebase SDK version must be a version such as 12.4.0.',
    ),
});

/**
 * The schema of a service worker config: the `jg-sw.config.json` file the CLI reads, or the
 * object passed to `buildServiceWorker`. `template` selects the worker: `base` caches the app,
 * and `firebase-fcm` also shows Firebase Cloud Messaging notifications.
 * @example
 * import { ServiceWorkerConfigSchema } from 'jg-sw/build';
 *
 * const config = ServiceWorkerConfigSchema.parse({
 *   outDir: 'dist',
 *   cacheNamePrefix: 'my-app',
 *   template: 'base',
 *   includeToPrecache: ['/', '/index.html', '/assets'],
 *   excludeFilesFromPrecache: [],
 *   excludeMIMETypesFromCache: ['application/json'],
 * });
 */
export const ServiceWorkerConfigSchema = z.discriminatedUnion('template', [
  BaseConfigSchema,
  FirebaseFcmConfigSchema,
]);

// a service worker config, validated by ServiceWorkerConfigSchema
export type IServiceWorkerConfig = z.infer<typeof ServiceWorkerConfigSchema>;

// the options Firebase's initializeApp receives in the worker
export const FirebaseOptionsSchema = z.strictObject({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});

export type IFirebaseOptions = z.infer<typeof FirebaseOptionsSchema>;

// the JSON value the environment variable named by firebaseConfigProcessEnvKey holds
export const FirebaseConfigSchema = z.object({
  options: FirebaseOptionsSchema,
});
