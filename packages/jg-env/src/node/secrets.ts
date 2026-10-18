import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Exception } from 'jg-exception';

import { createEnvironmentReader } from '../reader/index.js';
import { ERRORS, type ISchema } from '../shared/index.js';
import { parseJson } from '../shared/utilities.js';
import type { ISecretReader, ISecretReaderOptions } from './types.js';

/**
 * Creates the readers for secrets kept in files, such as Docker secrets. Inside a container, each
 * secret's variable holds the path to its file; elsewhere, the file is <KEY>.txt in the secrets
 * directory. A file is read as it is, without trimming. Errors name the secret and never its
 * value, and inside a container they leave out the path and the file system's error, which repeat
 * whatever the variable holds.
 * @param options Whether the program runs in a container, and the secrets directory.
 * @returns The readers.
 * @example
 * import { createSecretReader } from 'jg-env/node';
 *
 * const { readSecret } = createSecretReader({
 *   isRunningInContainer: process.env['IS_RUNNING_IN_CONTAINER'] === 'true',
 *   secretsDirectoryPath: '/srv/app/secrets',
 * });
 *
 * const databasePassword = readSecret('DATABASE_PASSWORD');
 */
export const createSecretReader = ({
  isRunningInContainer,
  secretsDirectoryPath,
}: ISecretReaderOptions): ISecretReader => {
  const environment = createEnvironmentReader(process.env);

  /**
   * Reads a secret's file.
   * @param key The secret's name.
   * @returns The file's text.
   * @throws
   * - ENV_VARIABLE_MISSING: The environment variable that holds the file's path is not set.
   * - ENV_SECRET_FILE_UNREADABLE: The secret's file could not be read, or is empty.
   */
  const readSecret = (key: string): string => {
    const path = isRunningInContainer
      ? environment.readString(key)
      : join(secretsDirectoryPath, `${key}.txt`);
    // the path is shown only outside a container, where it's built from values that aren't secret
    const where = isRunningInContainer ? '' : ` at ${path}`;
    const data = isRunningInContainer ? { key } : { key, path };
    let text: string;
    try {
      text = readFileSync(path, 'utf8');
    } catch (error) {
      throw new Exception(`The secret ${key}'s file${where} could not be read.`, {
        code: ERRORS.ENV_SECRET_FILE_UNREADABLE,
        data,
        ...(isRunningInContainer ? {} : { cause: error }),
      });
    }
    if (text === '') {
      throw new Exception(`The secret ${key}'s file${where} is empty.`, {
        code: ERRORS.ENV_SECRET_FILE_UNREADABLE,
        data,
      });
    }
    return text;
  };

  return {
    readSecret,
    readSecretJson: <T>(key: string, schema: ISchema<T>): T =>
      parseJson(`The secret ${key}`, key, readSecret(key), schema),
  };
};
