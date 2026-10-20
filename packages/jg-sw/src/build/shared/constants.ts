import type { IServiceWorkerEnvironment } from './types.js';

// the config file the CLI reads when --config isn't given
export const DEFAULT_CONFIG_FILE_NAME = 'jg-sw.config.json';

// the environment file loaded for each environment, relative to the cwd option
export const ENV_FILE_NAME_BY_ENVIRONMENT = {
  development: '.env',
  staging: '.env.staging',
  production: '.env.production',
} as const satisfies Record<IServiceWorkerEnvironment, string>;

// safe cache namespaces use lowercase alphanumeric tokens separated by single hyphens
export const CACHE_NAME_PREFIX_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// the Firebase SDK versions the worker can load, such as 12.4.0
export const FIREBASE_SDK_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

// separates an application-owned prefix from its random version suffix
export const CACHE_NAME_SEPARATOR = '--';

// the characters and length of the random version suffix
export const CACHE_NAME_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const CACHE_NAME_LENGTH = 10;

// the version suffix of a worker generated without caching, fixed so a development worker is the
// same on every request
export const DEVELOPMENT_CACHE_NAME_SUFFIX = 'development';
