import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import type { IPostgres } from '../postgres/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { buildCursorPage, listByCursor } from './cursor.js';

let postgres: IPostgres;
const table = createTableName('cursor_listing');

// the rows every test starts from
const ENTRIES = [
  { id: 1, origin: 'api-admin', label: 'first' },
  { id: 2, origin: 'api-worker', label: 'second' },
  { id: 3, origin: 'api-admin', label: 'third' },
  { id: 4, origin: 'api-worker', label: 'fourth' },
];

beforeAll(async () => {
  postgres = connectTestPostgres();
  await postgres.query(
    `CREATE TABLE ${table} (id BIGINT PRIMARY KEY, origin TEXT NOT NULL, label TEXT NOT NULL);`,
  );
});

beforeEach(async () => {
  await postgres.query(`DELETE FROM ${table};`);
  for (const { id, origin, label } of ENTRIES) {
    await postgres.query(`INSERT INTO ${table} (id, origin, label) VALUES ($1, $2, $3);`, [
      id,
      origin,
      label,
    ]);
  }
});

afterAll(async () => {
  await postgres.close();
});

describe('listByCursor', () => {
  const columns = ['id', 'origin', 'label'];

  test('lists the first page in descending ID order by default', async () => {
    await expect(listByCursor(postgres.pool, { table, columns, limit: 2 })).resolves.toStrictEqual([
      { id: '4', origin: 'api-worker', label: 'fourth' },
      { id: '3', origin: 'api-admin', label: 'third' },
    ]);
  });

  test('lists the next descending page after the cursor', async () => {
    await expect(
      listByCursor(postgres.pool, { table, columns, after: '3', limit: 2 }),
    ).resolves.toStrictEqual([
      { id: '2', origin: 'api-worker', label: 'second' },
      { id: '1', origin: 'api-admin', label: 'first' },
    ]);
  });

  test('applies equality filters before the cursor condition', async () => {
    await expect(
      listByCursor(postgres.pool, {
        table,
        columns,
        filters: [{ column: 'origin', value: 'api-admin' }],
        after: '3',
        limit: 10,
      }),
    ).resolves.toStrictEqual([{ id: '1', origin: 'api-admin', label: 'first' }]);
  });

  test('uses ascending order and cursor comparisons when asked', async () => {
    await expect(
      listByCursor(postgres.pool, { table, columns, sortDirection: 'ASC', after: '2', limit: 10 }),
    ).resolves.toStrictEqual([
      { id: '3', origin: 'api-admin', label: 'third' },
      { id: '4', origin: 'api-worker', label: 'fourth' },
    ]);
  });

  // BIGINT ids arrive as strings, so a page must follow the column's numeric order, not the text's
  test('keeps numeric cursor order for BIGINT ids, which arrive as strings', async () => {
    for (const [id, label] of [
      [8, 'eighth'],
      [9, 'ninth'],
      [10, 'tenth'],
      [11, 'eleventh'],
      [12, 'twelfth'],
    ] as const) {
      await postgres.query(`INSERT INTO ${table} (id, origin, label) VALUES ($1, 'api', $2);`, [
        id,
        label,
      ]);
    }

    const firstPage = await listByCursor<{ id: string }>(postgres.pool, {
      table,
      columns: ['id'],
      limit: 4,
    });
    const secondPage = await listByCursor<{ id: string }>(postgres.pool, {
      table,
      columns: ['id'],
      after: firstPage.at(-1)?.id,
      limit: 4,
    });

    expect(firstPage.map(({ id }) => id)).toStrictEqual(['12', '11', '10', '9']);
    expect(secondPage.map(({ id }) => id)).toStrictEqual(['8', '4', '3', '2']);
  });

  test('quotes every name, so reserved words and mixed case work', async () => {
    const quoted = createTableName('Order Items');
    await postgres.query(
      `CREATE TABLE "${quoted}" ("order" INTEGER PRIMARY KEY, "User" TEXT NOT NULL);
       INSERT INTO "${quoted}" ("order", "User") VALUES (1, 'a'), (2, 'b'), (3, 'a');`,
    );

    await expect(
      listByCursor(postgres.pool, {
        table: quoted,
        columns: ['order', 'User'],
        cursorColumn: 'order',
        filters: [{ column: 'User', value: 'a' }],
        limit: 10,
      }),
    ).resolves.toStrictEqual([
      { order: 3, User: 'a' },
      { order: 1, User: 'a' },
    ]);
  });

  test('works on a transaction client, and feeds buildCursorPage', async () => {
    const page = await postgres.transaction(async (client) =>
      buildCursorPage(
        await listByCursor<{ id: string }>(client, { table, columns: ['id'], limit: 3 }),
        2,
        ({ id }) => id,
      ),
    );

    expect(page).toStrictEqual({ items: [{ id: '4' }, { id: '3' }], nextCursor: '3' });
  });
});
