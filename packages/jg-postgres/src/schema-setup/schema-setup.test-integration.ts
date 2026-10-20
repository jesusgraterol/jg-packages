// @vitest-environment node
import { Client, DatabaseError } from 'pg';
import { expectToRejectCode } from 'jg-exception/testing';
import { afterEach, describe, expect, inject, test, vi } from 'vitest';

import { createPostgres, type IPostgres, type IPostgresConfig } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { createTestDatabaseName, dropTestDatabase } from '../testing/index.js';
import { defineTimeoutProfile } from '../timeouts/index.js';
import { ensureDatabase, initializeSchemaOnce } from './schema-setup.js';

// the databases and pools a test made, removed after it
const databases = new Set<string>();
const pools: IPostgres[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(pools.splice(0).map((pool) => pool.close()));
  for (const database of databases) {
    await dropTestDatabase({ ...inject('postgres'), database });
  }
  databases.clear();
});

/**
 * Builds the configuration of a test database, which the test's cleanup drops.
 * @param name What the database is for.
 * @returns The configuration.
 */
const testConfig = (name: string): IPostgresConfig => {
  const database = createTestDatabaseName(`${name}_${String(Math.random()).slice(2, 10)}`);
  databases.add(database);
  return { ...inject('postgres'), database };
};

/**
 * Checks whether the server has a database.
 * @param database The database's name.
 * @returns A promise that resolves to whether it does.
 */
const databaseExists = async (database: string): Promise<boolean> => {
  const maintenance = createPostgres({ ...inject('postgres'), max: 1 });
  try {
    const rows = await maintenance.query('SELECT 1 FROM pg_database WHERE datname = $1;', [
      database,
    ]);
    return rows.length === 1;
  } finally {
    await maintenance.close();
  }
};

/**
 * Creates a test database and connects to it.
 * @param name What the database is for.
 * @returns A promise that resolves to the database.
 */
const createDatabase = async (name: string): Promise<IPostgres> => {
  const config = testConfig(name);
  await ensureDatabase(config);
  // a dropped database ends the pool's idle connections, which isn't a failure here
  const postgres = createPostgres({ ...config, max: 4, onError: () => undefined });
  pools.push(postgres);
  return postgres;
};

/**
 * Lists the public schema's tables.
 * @param postgres The database.
 * @returns A promise that resolves to their names, sorted.
 */
const listTables = async (postgres: IPostgres): Promise<string[]> =>
  (
    await postgres.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;",
    )
  ).map(({ tablename }) => tablename);

const SCHEMA_STATEMENTS = [
  'CREATE TABLE note (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, body text NOT NULL);',
  'CREATE TABLE schema_migration (version integer PRIMARY KEY);',
];

describe('ensureDatabase', () => {
  test('creates a missing database, and leaves an existing one alone', async () => {
    const config = testConfig('ensure');

    await ensureDatabase(config);
    await ensureDatabase(config);

    expect(await databaseExists(config.database as string)).toBe(true);
  });

  test('lets concurrent calls all succeed', async () => {
    const config = testConfig('ensure_concurrent');

    await Promise.all(Array.from({ length: 8 }, () => ensureDatabase(config)));

    expect(await databaseExists(config.database as string)).toBe(true);
  });

  test('treats a database created between its check and its creation as success', async () => {
    const config = testConfig('ensure_race');
    await ensureDatabase(config);
    // the check misses the database, as when another process creates it right after
    vi.spyOn(Client.prototype, 'query').mockResolvedValueOnce({ rowCount: 0, rows: [] } as never);

    await expect(ensureDatabase(config)).resolves.toBeUndefined();
  });

  test.each([
    [
      'a database error',
      Object.assign(new DatabaseError('permission denied', 0, 'error'), { code: '42501' }),
    ],
    ['a lost connection', new Error('Connection terminated unexpectedly.')],
  ])('passes on another failure to create the database: %s', async (_, failure) => {
    // the check finds no database, and the creation fails for a reason other than a race
    vi.spyOn(Client.prototype, 'query')
      .mockResolvedValueOnce({ rowCount: 0, rows: [] } as never)
      .mockRejectedValueOnce(failure);

    await expect(ensureDatabase(testConfig('ensure_failed'))).rejects.toBe(failure);
  });

  test.each([
    ['onError', true],
    ['console.error by default', false],
  ])("sends the connection's errors outside any query to %s", async (_, hasOnError) => {
    const onError = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure = new Error('The server closed the connection.');
    const listen = vi.spyOn(Client.prototype, 'on');

    await ensureDatabase({ ...testConfig('ensure_errors'), ...(hasOnError ? { onError } : {}) });
    // the client's only error listener, as the client would call it for an idle connection's error
    const errorListeners = listen.mock.calls.filter(([event]) => event === 'error');
    expect(errorListeners).toHaveLength(1);
    (errorListeners[0]?.[1] as (error: unknown) => void)(failure);

    expect(hasOnError ? onError : consoleError).toHaveBeenCalledWith(failure);
  });

  test('refuses a configuration without a database', async () => {
    await expectToRejectCode(
      ensureDatabase({ ...inject('postgres'), database: undefined }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });

  test('refuses a database name PostgreSQL would cut short', async () => {
    await expectToRejectCode(
      ensureDatabase({ ...inject('postgres'), database: 'x'.repeat(64) }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });

  test('rejects when the server is unreachable', async () => {
    await expect(
      ensureDatabase({ ...inject('postgres'), host: '127.0.0.1', port: 1, database: 'app' }),
    ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
  });
});

describe('initializeSchemaOnce', () => {
  test('creates the schema once, and skips it afterwards', async () => {
    const postgres = await createDatabase('schema');

    await expect(
      initializeSchemaOnce(postgres, {
        statements: SCHEMA_STATEMENTS,
        markerTable: 'schema_migration',
        timeouts: defineTimeoutProfile({ statementTimeoutSeconds: 30, lockTimeoutSeconds: 10 }),
      }),
    ).resolves.toBe(true);
    await expect(
      initializeSchemaOnce(postgres, {
        statements: SCHEMA_STATEMENTS,
        markerTable: 'schema_migration',
      }),
    ).resolves.toBe(false);
    expect(await listTables(postgres)).toStrictEqual(['note', 'schema_migration']);
  });

  test('lets one of several concurrent initializations create the schema', async () => {
    const postgres = await createDatabase('schema_concurrent');

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        initializeSchemaOnce(postgres, {
          statements: SCHEMA_STATEMENTS,
          markerTable: 'schema_migration',
        }),
      ),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await listTables(postgres)).toStrictEqual(['note', 'schema_migration']);
  });

  test('refuses a public schema that holds objects but not the marker table', async () => {
    const postgres = await createDatabase('schema_occupied');
    await postgres.query(
      'CREATE FUNCTION answer() RETURNS integer LANGUAGE sql AS $$ SELECT 42 $$;',
    );

    const error = await initializeSchemaOnce(postgres, {
      statements: SCHEMA_STATEMENTS,
      markerTable: 'schema_migration',
    }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      code: ERRORS.SCHEMA_NOT_EMPTY,
      data: { markerTable: 'schema_migration' },
    });
    await expectToRejectCode(
      initializeSchemaOnce(postgres, {
        statements: SCHEMA_STATEMENTS,
        markerTable: 'schema_migration',
      }),
      ERRORS.SCHEMA_NOT_EMPTY,
      'The public schema holds objects but not the marker table',
    );
    expect(await listTables(postgres)).toStrictEqual([]);
  });

  test("rolls everything back when the statements don't create the marker table", async () => {
    const postgres = await createDatabase('schema_unmarked');

    await expectToRejectCode(
      initializeSchemaOnce(postgres, {
        statements: [SCHEMA_STATEMENTS[0] as string],
        markerTable: 'schema_migration',
      }),
      ERRORS.SCHEMA_MARKER_MISSING,
      "The schema statements didn't create the marker table.",
    );
    expect(await listTables(postgres)).toStrictEqual([]);
  });

  test('rolls everything back when a statement fails', async () => {
    const postgres = await createDatabase('schema_failing');

    await expect(
      initializeSchemaOnce(postgres, {
        statements: [SCHEMA_STATEMENTS[0] as string, 'CREATE TABLE broken (;'],
        markerTable: 'schema_migration',
      }),
    ).rejects.toMatchObject({ code: '42601' });
    expect(await listTables(postgres)).toStrictEqual([]);
  });

  test('refuses an invalid marker table name before connecting', async () => {
    const postgres = await createDatabase('schema_invalid');
    const connect = vi.spyOn(postgres.pool, 'connect');

    await expectToRejectCode(
      initializeSchemaOnce(postgres, { statements: SCHEMA_STATEMENTS, markerTable: '' }),
      ERRORS.INVALID_IDENTIFIER,
    );
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('dropTestDatabase', () => {
  test('drops a test database with open connections, and ignores one that is gone', async () => {
    const postgres = await createDatabase('drop');
    await postgres.query('SELECT 1;');
    const database = postgres.pool.options.database as string;

    await dropTestDatabase({ ...inject('postgres'), database });
    await dropTestDatabase({ ...inject('postgres'), database });

    expect(await databaseExists(database)).toBe(false);
  });
});
