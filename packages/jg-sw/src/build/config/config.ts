import { Exception, extractMessage } from 'jg-exception';
import { readJSONFile } from 'jg-fs';
import type { z } from 'zod';

import {
  ENV_FILE_NAME_BY_ENVIRONMENT,
  ERRORS,
  type IServiceWorkerEnvironment,
} from '../shared/index.js';
import { ServiceWorkerConfigSchema, type IServiceWorkerConfig } from './schema.js';

/**
 * Picks the code for a config that failed validation: a bad template or Firebase SDK version
 * alone gets its own code, and anything else is a bad config.
 * @param issues The validation issues.
 * @returns The error code.
 */
const getConfigErrorCode = (issues: z.core.$ZodIssue[]): string => {
  if (issues.every(({ code, path }) => code === 'invalid_union' && path[0] === 'template')) {
    return ERRORS.INVALID_TEMPLATE_NAME;
  }
  if (
    issues.every(({ code, path }) => code === 'invalid_format' && path[0] === 'firebaseSdkVersion')
  ) {
    return ERRORS.INVALID_FIREBASE_SDK_VERSION;
  }
  return ERRORS.FAILED_TO_READ_BASE_CONFIG;
};

/**
 * Validates a service worker config.
 * @param value The config to validate.
 * @param source Where the config came from, such as its file path, for the error message.
 * @returns The config.
 * @throws
 * - INVALID_TEMPLATE_NAME: The template must be 'base' or 'firebase-fcm'.
 * - INVALID_FIREBASE_SDK_VERSION: The Firebase SDK version must be a version such as 12.4.0.
 * - FAILED_TO_READ_BASE_CONFIG: The service worker config is invalid.
 */
export const parseServiceWorkerConfig = (value: unknown, source?: string): IServiceWorkerConfig => {
  const result = ServiceWorkerConfigSchema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const issues = result.error.issues
    .map(({ path, message }) => `${path.length === 0 ? 'config' : path.join('.')}: ${message}`)
    .join('; ');
  throw new Exception(
    `The service worker config${source === undefined ? '' : ` '${source}'`} is invalid: ${issues}`,
    { code: getConfigErrorCode(result.error.issues) },
  );
};

/**
 * Checks the environment option, which JavaScript callers and the CLI pass unchecked.
 * @param environment The environment, or undefined when none was given.
 * @returns The environment.
 * @throws
 * - INVALID_ENVIRONMENT: The environment must be development, staging, or production.
 */
export const parseEnvironment = (
  environment: string | undefined,
): IServiceWorkerEnvironment | undefined => {
  if (environment === undefined || Object.hasOwn(ENV_FILE_NAME_BY_ENVIRONMENT, environment)) {
    return environment as IServiceWorkerEnvironment | undefined;
  }
  throw new Exception(
    `The environment '${environment}' isn't supported. Use development, staging, or production.`,
    { code: ERRORS.INVALID_ENVIRONMENT },
  );
};

/**
 * Reads and validates a service worker config file, such as `jg-sw.config.json`.
 * @param path The config file's path.
 * @returns A promise that resolves to the config.
 * @example
 * const config = await readServiceWorkerConfig('jg-sw.config.json');
 * config.template; // 'base'
 * @throws
 * - FAILED_TO_READ_BASE_CONFIG: Unable to read the service worker config, or it is invalid.
 * - INVALID_TEMPLATE_NAME: The template must be 'base' or 'firebase-fcm'.
 * - INVALID_FIREBASE_SDK_VERSION: The Firebase SDK version must be a version such as 12.4.0.
 */
export const readServiceWorkerConfig = async (path: string): Promise<IServiceWorkerConfig> => {
  let value: unknown;
  try {
    value = await readJSONFile<unknown>(path);
  } catch (error) {
    throw new Exception(
      `Unable to read the service worker config '${path}': ${extractMessage(error)}`,
      { code: ERRORS.FAILED_TO_READ_BASE_CONFIG },
    );
  }
  return parseServiceWorkerConfig(value, path);
};
