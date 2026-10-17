import { resolve } from 'node:path';
import { Exception, extractMessage } from 'jg-exception';
import { pathExists } from 'jg-fs';

import {
  ENV_FILE_NAME_BY_ENVIRONMENT,
  ERRORS,
  type IServiceWorkerEnvironment,
} from '../shared/index.js';
import { FirebaseConfigSchema, type IFirebaseOptions } from './schema.js';

/**
 * Loads the environment's file into process.env when it exists. Variables already set keep their
 * values.
 * @param cwd The directory the file is resolved from.
 * @param environment The environment.
 * @returns A promise that resolves once the file is loaded, or found missing.
 * @throws
 * - FAILED_TO_BUILD_CONFIG: Unable to load the environment file.
 */
const loadEnvironmentFile = async (
  cwd: string,
  environment: IServiceWorkerEnvironment,
): Promise<void> => {
  const path = resolve(cwd, ENV_FILE_NAME_BY_ENVIRONMENT[environment]);
  if (!(await pathExists(path))) {
    return;
  }
  try {
    process.loadEnvFile(path);
  } catch (error) {
    throw new Exception(
      `Unable to load the environment file '${path}': ${extractMessage(error)}`,
      ERRORS.FAILED_TO_BUILD_CONFIG,
    );
  }
};

/**
 * Reads the Firebase options the firebase-fcm worker is initialized with, from the environment
 * variable the config names, after loading the environment's file.
 * @param envKey The environment variable that holds the Firebase config.
 * @param environment The environment, which selects the environment file.
 * @param cwd The directory the environment file is resolved from.
 * @returns A promise that resolves to the Firebase options.
 * @throws
 * - INVALID_ENVIRONMENT: The firebase-fcm template needs an environment.
 * - FAILED_TO_BUILD_CONFIG: Unable to load the environment file.
 * - INVALID_FIREBASE_CONFIG: The environment variable that holds the Firebase config is missing or
 *   empty.
 * - FAILED_TO_READ_FIREBASE_CONFIG: Unable to read the Firebase config from the environment
 *   variable.
 */
export const readFirebaseOptions = async (
  envKey: string,
  environment: IServiceWorkerEnvironment | undefined,
  cwd: string,
): Promise<IFirebaseOptions> => {
  if (environment === undefined) {
    throw new Exception(
      'The firebase-fcm template needs an environment, which selects the environment file that holds its Firebase config. Pass --environment, or the environment option.',
      ERRORS.INVALID_ENVIRONMENT,
    );
  }
  await loadEnvironmentFile(cwd, environment);

  const value = process.env[envKey];
  if (value === undefined || value.trim() === '') {
    throw new Exception(
      `The environment variable '${envKey}' that holds the Firebase config is missing or empty.`,
      ERRORS.INVALID_FIREBASE_CONFIG,
    );
  }
  try {
    return FirebaseConfigSchema.parse(JSON.parse(value)).options;
  } catch (error) {
    throw new Exception(
      `Unable to read the Firebase config from the environment variable '${envKey}': ${extractMessage(error)}`,
      ERRORS.FAILED_TO_READ_FIREBASE_CONFIG,
    );
  }
};
