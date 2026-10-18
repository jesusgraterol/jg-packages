import { setTimeout } from 'node:timers/promises';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

import { createAdvisoryLockKey } from '../locks/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { lockOrderedList, moveDown, moveUp } from './sorting.js';

let postgres: IPostgres;
const table = createTableName('sorting');
const scopedTable = createTableName('scoped_sorting');
const constraint = `uq_${table}__sort_order`;
const scopedConstraint = `uq_${scopedTable}__group_id_sort_order`;
const options = { table, sortOrderConstraint: constraint };

// the rows every test starts from
const ENTRIES = [
  { id: 1, sort_order: 10 },
  { id: 2, sort_order: 20 },
  { id: 3, sort_order: 30 },
  { id: 4, sort_order: 40 },
];
const SCOPED_ENTRIES = [
  { id: 1, group_id: 1, sort_order: 10 },
  { id: 2, group_id: 1, sort_order: 20 },
  { id: 3, group_id: 1, sort_order: 30 },
  { id: 4, group_id: 2, sort_order: 10 },
  { id: 5, group_id: 2, sort_order: 20 },
  { id: 6, group_id: 2, sort_order: 30 },
];

/**
 * Reads a table's rows in id order.
 * @param name The table.
 * @returns A promise that resolves to its rows.
 */
const readRows = async (name: string): Promise<unknown[]> =>
  postgres.query(`SELECT * FROM ${name} ORDER BY id;`);

beforeAll(async () => {
  postgres = connectTestPostgres();
  await postgres.query(`
    CREATE TABLE ${table} (
      id INTEGER PRIMARY KEY,
      sort_order INTEGER NOT NULL,
      CONSTRAINT ${constraint} UNIQUE (sort_order) DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE TABLE ${scopedTable} (
      id INTEGER PRIMARY KEY,
      group_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      CONSTRAINT ${scopedConstraint} UNIQUE (group_id, sort_order) DEFERRABLE INITIALLY IMMEDIATE
    );
  `);
});

beforeEach(async () => {
  await postgres.query(`DELETE FROM ${table}; DELETE FROM ${scopedTable};`);
  for (const { id, sort_order } of ENTRIES) {
    await postgres.query(`INSERT INTO ${table} VALUES ($1, $2);`, [id, sort_order]);
  }
  for (const { id, group_id, sort_order } of SCOPED_ENTRIES) {
    await postgres.query(`INSERT INTO ${scopedTable} VALUES ($1, $2, $3);`, [
      id,
      group_id,
      sort_order,
    ]);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await postgres.close();
});

describe('moveUp', () => {
  test('swaps the row with the closest previous sort order', async () => {
    await expect(moveUp(postgres, 3, options)).resolves.toBeUndefined();
    await expect(readRows(table)).resolves.toStrictEqual([
      { id: 1, sort_order: 10 },
      { id: 2, sort_order: 30 },
      { id: 3, sort_order: 20 },
      { id: 4, sort_order: 40 },
    ]);
  });

  test('rejects a row that does not exist, and changes nothing', async () => {
    await expectToRejectCode(
      moveUp(postgres, 999, options),
      ERRORS.ROW_NOT_FOUND,
      'The row does not exist in the ordered list.',
    );
    await expect(readRows(table)).resolves.toStrictEqual(ENTRIES);
  });

  test('rejects the first row, and changes nothing', async () => {
    await expectToRejectCode(
      moveUp(postgres, 1, options),
      ERRORS.ROW_ALREADY_FIRST,
      'The row is already first in the ordered list.',
    );
    await expect(readRows(table)).resolves.toStrictEqual(ENTRIES);
  });

  test("waits for the ordered list's lock before moving the row", async () => {
    let hasMoved = false;
    let move: Promise<void> | undefined;

    await postgres.transaction(async (client) => {
      await lockOrderedList(client, { table });
      move = moveUp(postgres, 2, options).then(() => {
        hasMoved = true;
      });
      await setTimeout(150);
      expect(hasMoved).toBe(false);
    });
    await move;

    expect(hasMoved).toBe(true);
    await expect(readRows(table)).resolves.toStrictEqual([
      { id: 1, sort_order: 20 },
      { id: 2, sort_order: 10 },
      { id: 3, sort_order: 30 },
      { id: 4, sort_order: 40 },
    ]);
  });

  test('quotes its names, and rejects one PostgreSQL would cut short', async () => {
    await expectToRejectCode(
      moveUp(postgres, 2, { ...options, sortOrderColumn: 'a'.repeat(64) }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });
});

describe('moveDown', () => {
  test('swaps the row with the closest next sort order', async () => {
    await expect(moveDown(postgres, 2, options)).resolves.toBeUndefined();
    await expect(readRows(table)).resolves.toStrictEqual([
      { id: 1, sort_order: 10 },
      { id: 2, sort_order: 30 },
      { id: 3, sort_order: 20 },
      { id: 4, sort_order: 40 },
    ]);
  });

  test('rejects a row that does not exist, or the last row, and changes nothing', async () => {
    await expectToRejectCode(moveDown(postgres, 999, options), ERRORS.ROW_NOT_FOUND);
    await expectToRejectCode(
      moveDown(postgres, 4, options),
      ERRORS.ROW_ALREADY_LAST,
      'The row is already last in the ordered list.',
    );
    await expect(readRows(table)).resolves.toStrictEqual(ENTRIES);
  });

  test('keeps a consistent order across mixed moves', async () => {
    await moveDown(postgres, 2, options);
    await moveUp(postgres, 4, options);
    await moveDown(postgres, 1, options);

    await expect(
      postgres.query(`SELECT id, sort_order FROM ${table} ORDER BY sort_order;`),
    ).resolves.toStrictEqual([
      { id: 3, sort_order: 10 },
      { id: 1, sort_order: 20 },
      { id: 4, sort_order: 30 },
      { id: 2, sort_order: 40 },
    ]);
  });
});

describe('scoped ordered lists', () => {
  const scopedOptions = (groupId: number) => ({
    table: scopedTable,
    sortOrderConstraint: scopedConstraint,
    scope: [{ column: 'group_id', value: groupId }],
  });

  test('moveUp swaps only within the scoped list', async () => {
    await moveUp(postgres, 3, scopedOptions(1));

    await expect(readRows(scopedTable)).resolves.toStrictEqual([
      { id: 1, group_id: 1, sort_order: 10 },
      { id: 2, group_id: 1, sort_order: 30 },
      { id: 3, group_id: 1, sort_order: 20 },
      ...SCOPED_ENTRIES.slice(3),
    ]);
  });

  test('moveDown swaps only within the scoped list', async () => {
    await moveDown(postgres, 4, scopedOptions(2));

    await expect(readRows(scopedTable)).resolves.toStrictEqual([
      ...SCOPED_ENTRIES.slice(0, 3),
      { id: 4, group_id: 2, sort_order: 20 },
      { id: 5, group_id: 2, sort_order: 10 },
      { id: 6, group_id: 2, sort_order: 30 },
    ]);
  });

  test('rejects a row outside the scope, and changes nothing', async () => {
    await expectToRejectCode(moveUp(postgres, 3, scopedOptions(2)), ERRORS.ROW_NOT_FOUND);
    await expect(readRows(scopedTable)).resolves.toStrictEqual(SCOPED_ENTRIES);
  });
});

describe('a move the database reports wrongly', () => {
  test.each([
    ['no report', []],
    ['one updated row', [{ has_current: true, has_neighbor: true, updated_count: 1 }]],
  ])('rejects %s as MOVE_FAILED, and rolls back', async (_, report) => {
    const client = await postgres.pool.connect();
    vi.spyOn(postgres.pool, 'connect').mockResolvedValueOnce(client as never);
    const realQuery = client.query.bind(client) as (...args: unknown[]) => unknown;
    // every other query, including the pool's own, with its callback, goes through untouched
    vi.spyOn(client, 'query').mockImplementation((...args: unknown[]) =>
      typeof args[0] === 'string' && args[0].startsWith('WITH current_entry')
        ? Promise.resolve({ rows: report })
        : realQuery(...args),
    );

    await expectToRejectCode(
      moveUp(postgres, 2, options),
      ERRORS.MOVE_FAILED,
      'The move did not update exactly two rows.',
    );
    await expect(readRows(table)).resolves.toStrictEqual(ENTRIES);
  });
});

describe('lockOrderedList', () => {
  // Moldea locks its lists with these keys, so both block each other while either runs
  test("locks the key Moldea's moves lock, whatever order the scope is in", async () => {
    const querySpy = vi.fn();
    const client = { query: querySpy } as never;

    await lockOrderedList(client, { table: 'category' });
    await lockOrderedList(client, {
      table: 'category',
      sortOrderColumn: 'position',
      scope: [
        { column: 'section_id', value: 2 },
        { column: 'group_id', value: 1 },
      ],
    });

    expect(querySpy.mock.calls).toStrictEqual([
      [
        'SELECT pg_advisory_xact_lock($1::bigint);',
        [createAdvisoryLockKey('database:move:category:sort_order')],
      ],
      [
        'SELECT pg_advisory_xact_lock($1::bigint);',
        [createAdvisoryLockKey('database:move:category:position:group_id:1|section_id:2')],
      ],
    ]);
  });
});
