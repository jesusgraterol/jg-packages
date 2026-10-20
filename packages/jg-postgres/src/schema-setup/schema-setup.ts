import { Exception } from 'jg-exception';

import { isDatabaseError } from '../database-errors/index.js';
import { quoteIdentifier } from '../identifiers/index.js';
import { createAdvisoryLockKey, lockTransaction } from '../locks/index.js';
import type { IPostgres, IPostgresConfig } from '../postgres/index.js';
import { ERRORS, withMaintenanceClient } from '../shared/index.js';
import type { IInitializeSchemaOptions } from './types.js';
import { hasPublicTable, isPublicSchemaOccupied } from './utilities.js';

// the advisory lock that lets one initialization at a time check and create the schema
const INITIALIZE_SCHEMA_LOCK_KEY = createAdvisoryLockKey('jg-postgres:initialize-schema');

/**
 * Creates a database when the server doesn't have it yet, connecting to the maintenance database,
 * `postgres`, with the rest of the configuration. Another process creating it at the same time
 * counts as success, so every replica of an app can call it at startup.
 * @param config The configuration of the database to create, as createPostgres takes it.
 * @returns A promise that resolves once the database exists.
 * @example
 * import { createPostgres, ensureDatabase, type IPostgresConfig } from 'jg-postgres';
 *
 * const config: IPostgresConfig = { host: 'localhost', database: 'app', user: 'app', password: 'secret' };
 * await ensureDatabase(config);
 * const postgres = createPostgres(config);
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const ensureDatabase = async (config: IPostgresConfig): Promise<void> => {
  const { database } = config;
  const quotedDatabase = quoteIdentifier(database ?? '');
  await withMaintenanceClient(config, async (client) => {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_catalog.pg_database WHERE datname = $1;',
      [database],
    );
    if (Number(rowCount) > 0) {
      return;
    }
    try {
      await client.query(`CREATE DATABASE ${quotedDatabase};`);
    } catch (error) {
      // another session created it first: duplicate_database, or a unique violation in the catalog
      const isCreatedElsewhere =
        isDatabaseError(error) && (error.code === '42P04' || error.code === '23505');
      if (!isCreatedElsewhere) {
        throw error;
      }
    }
  });
};

/**
 * Creates an app's schema once: in one transaction, under an advisory lock, it skips when the
 * public schema already has the marker table, refuses a public schema that holds anything else,
 * and otherwise runs the statements and checks they created the marker table. Every replica of an
 * app can call it at startup: one creates the schema, and the others wait for it and skip. A
 * statement that fails, or a marker the statements didn't create, rolls everything back.
 * @param postgres The database.
 * @param options The statements, the marker table they create, and the transaction's timeouts.
 * @returns A promise that resolves to true when it created the schema, and false when the marker
 * table was already there.
 * @example
 * import { createPostgres, initializeSchemaOnce } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * await initializeSchemaOnce(postgres, {
 *   statements: [
 *     'CREATE TABLE note (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text NOT NULL);',
 *     'CREATE TABLE schema_migration (version integer PRIMARY KEY);',
 *   ],
 *   markerTable: 'schema_migration',
 * });
 * @throws
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 * - SCHEMA_NOT_EMPTY: The public schema holds objects but not the marker table, so its initialization never finished.
 * - SCHEMA_MARKER_MISSING: The schema statements didn't create the marker table.
 * - TRANSACTION_OUTCOME_UNKNOWN: The connection was lost during COMMIT, so the transaction may or may not have committed.
 */
export const initializeSchemaOnce = async (
  postgres: IPostgres,
  { statements, markerTable, timeouts }: IInitializeSchemaOptions,
): Promise<boolean> => {
  quoteIdentifier(markerTable);
  return postgres.transaction(
    async (client) => {
      await lockTransaction(client, INITIALIZE_SCHEMA_LOCK_KEY);
      if (await hasPublicTable(client, markerTable)) {
        return false;
      }
      if (await isPublicSchemaOccupied(client)) {
        throw new Exception(
          'The public schema holds objects but not the marker table, so its initialization never finished.',
          { code: ERRORS.SCHEMA_NOT_EMPTY, data: { markerTable } },
        );
      }
      for (const statement of statements) {
        await client.query(statement);
      }
      if (!(await hasPublicTable(client, markerTable))) {
        throw new Exception("The schema statements didn't create the marker table.", {
          code: ERRORS.SCHEMA_MARKER_MISSING,
          data: { markerTable },
        });
      }
      return true;
    },
    { timeouts },
  );
};
