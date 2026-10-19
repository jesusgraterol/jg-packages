// @vitest-environment node
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import { quoteIdentifier } from '../identifiers/index.js';
import type { IPostgres } from '../postgres/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';

import { listTableSizes, readDatabaseSummary } from './introspection.js';

let postgres: IPostgres;
let schema: string;
let publicTable: string;

beforeAll(async () => {
  postgres = connectTestPostgres();
  schema = createTableName('introspection');
  publicTable = createTableName('introspection_public');
  const quotedSchema = quoteIdentifier(schema);
  await postgres.query(`CREATE SCHEMA ${quotedSchema};`);
  await postgres.query(
    `CREATE TABLE ${quotedSchema}.alpha (id bigint PRIMARY KEY, payload text NOT NULL);`,
  );
  await postgres.query(
    `INSERT INTO ${quotedSchema}.alpha (id, payload)
    SELECT series.value, repeat('x', 200) FROM generate_series(1, 2000) AS series(value);`,
  );
  await postgres.query(`CREATE TABLE ${quotedSchema}.beta (id bigint);`);
  await postgres.query(`CREATE TABLE ${quotedSchema}."Upper" (id bigint);`);
  await postgres.query(`CREATE VIEW ${quotedSchema}.gamma AS SELECT 1 AS id;`);
  await postgres.query(`CREATE SEQUENCE ${quotedSchema}.delta;`);
  await postgres.query(`CREATE TABLE ${quoteIdentifier(publicTable)} (id bigint);`);
});

afterAll(async () => {
  await postgres.query(`DROP SCHEMA ${quoteIdentifier(schema)} CASCADE;`);
  await postgres.query(`DROP TABLE ${quoteIdentifier(publicTable)};`);
  await postgres.close();
});

describe('readDatabaseSummary', () => {
  test("reads the database's name, the server's version, and positive sizes and counts", async () => {
    const summary = await readDatabaseSummary(postgres.pool, { schema });

    expect(summary).toMatchObject({ name: 'postgres', tableCount: 3 });
    expect(summary.serverVersion).toMatch(/^18\.\d+/);
    expect(Math.floor(summary.serverVersionNumber / 10_000)).toBe(18);
    expect(Number.isSafeInteger(summary.sizeBytes) && summary.sizeBytes > 0).toBe(true);
    // the summary's own query is active while it counts
    expect(summary.activeConnections).toBeGreaterThanOrEqual(1);
    expect(summary.maxConnections).toBeGreaterThanOrEqual(summary.activeConnections);
  });

  test('counts the public schema by default, on a client too', async () => {
    const client = await postgres.pool.connect();
    try {
      // one snapshot, so tables other test files create meanwhile can't change the count
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ;');
      const summary = await readDatabaseSummary(client);
      const { rows } = await client.query<{ table_count: string }>(
        `SELECT count(*) AS table_count
        FROM pg_tables
        WHERE pg_tables.schemaname = 'public';`,
      );
      await client.query('COMMIT;');

      expect(summary.tableCount).toBe(Number(rows[0]?.table_count));
      expect(summary.tableCount).toBeGreaterThanOrEqual(1);
    } finally {
      client.release();
    }
  });

  test('counts no tables in a schema that has none, or that does not exist', async () => {
    expect((await readDatabaseSummary(postgres.pool, { schema: 'pg_toast' })).tableCount).toBe(0);
    expect(
      (await readDatabaseSummary(postgres.pool, { schema: `${schema}_missing` })).tableCount,
    ).toBe(0);
  });
});

describe('listTableSizes', () => {
  test("lists only the schema's ordinary tables, sorted by name, with their total sizes", async () => {
    const tables = await listTableSizes(postgres.pool, { schema });

    expect(tables.map(({ name }) => name)).toStrictEqual(['Upper', 'alpha', 'beta']);
    const [upper, alpha, beta] = tables;
    // 2,000 rows of 200 characters, with the primary key's index
    expect(alpha?.totalBytes).toBeGreaterThan(400_000);
    expect(alpha?.totalBytes).toBeGreaterThan(beta?.totalBytes ?? 0);
    for (const table of [upper, beta]) {
      expect(Number.isSafeInteger(table?.totalBytes) && (table?.totalBytes ?? -1) >= 0).toBe(true);
    }
  });

  test('reads the public schema by default', async () => {
    const tables = await listTableSizes(postgres.pool);

    expect(tables.map(({ name }) => name)).toContain(publicTable);
    expect(tables.map(({ name }) => name)).not.toContain('alpha');
  });
});
