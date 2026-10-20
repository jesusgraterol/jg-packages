import { Exception } from 'jg-exception';

import { quoteIdentifier } from '../identifiers/index.js';
import type { IPostgresConfig } from '../postgres/index.js';
import { ERRORS, withMaintenanceClient } from '../shared/index.js';
import { MAX_DATABASE_NAME_BYTES, TEST_DATABASE_NAME_PATTERN } from './constants.js';

/**
 * Builds the INVALID_TEST_DATABASE_NAME exception.
 * @param name The name that was refused.
 * @returns The exception.
 */
const invalidTestDatabaseName = (name: unknown): Exception =>
  new Exception(
    "The test database name must hold only lowercase letters, digits, and underscores, start with this process's test_<pid>_ prefix, and be at most 63 bytes.",
    {
      code: ERRORS.INVALID_TEST_DATABASE_NAME,
      data: { name: typeof name === 'string' ? name.slice(0, 100) : null },
    },
  );

/**
 * Reads the prefix of this process's test databases.
 * @returns The prefix, such as `test_4242_`.
 */
const readTestDatabasePrefix = (): string => `test_${String(process.pid)}_`;

/**
 * Checks whether a name is a test database's name from this process: the prefix, then at least one
 * lowercase letter, digit, or underscore, and at most 63 bytes.
 * @param name The name.
 * @returns Whether it is.
 */
const isOwnTestDatabaseName = (name: unknown): name is string =>
  typeof name === 'string' &&
  name.startsWith(readTestDatabasePrefix()) &&
  name.length > readTestDatabasePrefix().length &&
  TEST_DATABASE_NAME_PATTERN.test(name) &&
  name.length <= MAX_DATABASE_NAME_BYTES;

/**
 * Names a database for this process's tests, `test_<pid>_<name>`, so test runs in parallel each
 * get their own and `dropTestDatabase` drops only this process's.
 * @param name What the database is for, in lowercase letters, digits, and underscores, such as
 * `primary`.
 * @returns The database's name, such as `test_4242_primary`.
 * @example
 * import { createTestDatabaseName } from 'jg-postgres/testing';
 *
 * createTestDatabaseName('primary'); // => 'test_4242_primary', with this process's id
 * @throws
 * - INVALID_TEST_DATABASE_NAME: The test database name must hold only lowercase letters, digits, and underscores, start with this process's test_<pid>_ prefix, and be at most 63 bytes.
 */
export const createTestDatabaseName = (name: string): string => {
  const databaseName = `${readTestDatabasePrefix()}${typeof name === 'string' ? name : ''}`;
  if (!isOwnTestDatabaseName(databaseName)) {
    throw invalidTestDatabaseName(name);
  }
  return databaseName;
};

/**
 * Drops a test database, ending its connections first, after checking its name is one
 * createTestDatabaseName gave this process, so a configuration that points at a real database
 * can never drop it. A database that doesn't exist is no error.
 * @param config The test database's configuration, as createPostgres takes it.
 * @returns A promise that resolves once the database is gone.
 * @example
 * import { createTestDatabaseName, dropTestDatabase } from 'jg-postgres/testing';
 *
 * await dropTestDatabase({ host: 'localhost', user: 'postgres', database: createTestDatabaseName('primary') });
 * @throws
 * - INVALID_TEST_DATABASE_NAME: The test database name must hold only lowercase letters, digits, and underscores, start with this process's test_<pid>_ prefix, and be at most 63 bytes.
 */
export const dropTestDatabase = async (config: IPostgresConfig): Promise<void> => {
  const { database } = config;
  if (!isOwnTestDatabaseName(database)) {
    throw invalidTestDatabaseName(database);
  }
  await withMaintenanceClient(config, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(database)} WITH (FORCE);`);
  });
};
