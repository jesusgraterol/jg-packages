import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { z, ZodError } from 'zod';

import type { IPostgres } from '../postgres/index.js';
import { connectTestPostgres } from '../test-utils/database.js';
import { createRecordStore } from './record-store.js';

// the table the README documents, which the app creates and the package never does
const RECORD_STORE_TABLE = `
  CREATE TABLE IF NOT EXISTS record_store (
    id    varchar(512),
    value jsonb        NOT NULL,
    CONSTRAINT pk_rs__id PRIMARY KEY (id),
    CONSTRAINT chk_rs__id_non_empty CHECK (id <> ''),
    CONSTRAINT chk_rs__value_object CHECK (jsonb_typeof(value) = 'object')
  );
`;

let postgres: IPostgres;

/**
 * Creates a record id no other test uses.
 * @returns The id.
 */
const createRecordId = (): string => `test:record-store:${randomUUID()}`;

// a record whose fields each have a default
const CountersSchema = z.object({ retries: z.number(), isEnabled: z.boolean(), label: z.string() });
type ICounters = z.infer<typeof CountersSchema>;
const COUNTER_DEFAULTS: ICounters = { retries: 3, isEnabled: true, label: 'default-value' };

/**
 * Creates a store for a counters record.
 * @param id The record's id.
 * @returns The store.
 */
const createCounters = (id: string) =>
  createRecordStore({ postgres, id, defaults: COUNTER_DEFAULTS, schema: CountersSchema });

/**
 * Reads a record's stored JSON as it is.
 * @param id The record's id.
 * @returns A promise that resolves to the stored value, or undefined.
 */
const readStoredValue = async (id: string): Promise<unknown> =>
  (
    await postgres.query<{ value: unknown }>('SELECT value FROM record_store WHERE id = $1;', [id])
  )[0]?.value;

beforeAll(async () => {
  postgres = connectTestPostgres();
  await postgres.query(RECORD_STORE_TABLE);
});

afterAll(async () => {
  await postgres.close();
});

describe('the record_store table', () => {
  test('rejects an empty id', async () => {
    await expect(
      postgres.query('INSERT INTO record_store (id, value) VALUES ($1, $2);', ['', {}]),
    ).rejects.toThrow('chk_rs__id_non_empty');
  });

  test.each([
    ['an array', '[]'],
    ['JSON null', 'null'],
    ['a scalar', '"record"'],
  ])('rejects %s as a value', async (_, value) => {
    await expect(
      postgres.query('INSERT INTO record_store (id, value) VALUES ($1, $2::jsonb);', [
        createRecordId(),
        value,
      ]),
    ).rejects.toThrow('chk_rs__value_object');
  });
});

describe('createRecordStore', () => {
  test('returns the defaults while the record does not exist', async () => {
    await expect(createCounters(createRecordId()).get()).resolves.toStrictEqual(COUNTER_DEFAULTS);
  });

  test('stores and reads a record', async () => {
    const counters = createCounters(createRecordId());
    const record = { retries: 5, isEnabled: false, label: 'stored-value' };

    await expect(counters.set(record)).resolves.toBeUndefined();
    await expect(counters.get()).resolves.toStrictEqual(record);
  });

  test('fills undefined and null fields with the defaults before storing', async () => {
    const id = createRecordId();

    await createCounters(id).set({
      retries: 5,
      isEnabled: undefined as unknown as boolean,
      label: null as unknown as string,
    });

    await expect(readStoredValue(id)).resolves.toStrictEqual({
      retries: 5,
      isEnabled: true,
      label: 'default-value',
    });
  });

  test('keeps only the default keys in a write', async () => {
    const id = createRecordId();

    await createCounters(id).set({
      ...COUNTER_DEFAULTS,
      retries: 9,
      extra: 'dropped',
    } as ICounters);

    await expect(readStoredValue(id)).resolves.toStrictEqual({ ...COUNTER_DEFAULTS, retries: 9 });
  });

  test("merges the stored record over another store's defaults for the same id", async () => {
    const id = createRecordId();
    await createRecordStore({
      postgres,
      id,
      defaults: { retries: 3, nested: { label: 'default-value' } },
      schema: z.object({ retries: z.number(), nested: z.object({ label: z.string() }) }),
    }).set({ retries: 10, nested: { label: 'stored-value' } });

    await expect(
      createRecordStore({
        postgres,
        id,
        defaults: { retries: 3, isEnabled: true, nested: { label: 'default-value' } },
        schema: z.object({
          retries: z.number(),
          isEnabled: z.boolean(),
          nested: z.object({ label: z.string() }),
        }),
      }).get(),
    ).resolves.toStrictEqual({ retries: 10, isEnabled: true, nested: { label: 'stored-value' } });
  });

  test('updates the one row an id has', async () => {
    const id = createRecordId();
    const counters = createCounters(id);

    await counters.set({ ...COUNTER_DEFAULTS, retries: 1 });
    await counters.set({ ...COUNTER_DEFAULTS, retries: 2 });

    await expect(counters.get()).resolves.toStrictEqual({ ...COUNTER_DEFAULTS, retries: 2 });
    await expect(
      postgres.query('SELECT COUNT(*)::integer AS count FROM record_store WHERE id = $1;', [id]),
    ).resolves.toStrictEqual([{ count: 1 }]);
  });

  test('keeps instances with different ids apart', async () => {
    const first = createCounters(createRecordId());
    const second = createCounters(createRecordId());

    await first.set({ ...COUNTER_DEFAULTS, retries: 7 });

    await expect(first.get()).resolves.toStrictEqual({ ...COUNTER_DEFAULTS, retries: 7 });
    await expect(second.get()).resolves.toStrictEqual(COUNTER_DEFAULTS);
  });

  test("runs every method in a caller's transaction, without committing it", async () => {
    const id = createRecordId();
    const counters = createCounters(id);
    const rollback = new Error('roll back');

    await expect(
      postgres.transaction(async (client) => {
        await counters.set({ ...COUNTER_DEFAULTS, retries: 7 }, client);
        await counters.incrementNumber('retries', 1, client);
        await expect(counters.get(client)).resolves.toStrictEqual({
          ...COUNTER_DEFAULTS,
          retries: 8,
        });
        await counters.setNumber('retries', 20, client);
        await expect(counters.get(client)).resolves.toStrictEqual({
          ...COUNTER_DEFAULTS,
          retries: 20,
        });
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await expect(counters.get()).resolves.toStrictEqual(COUNTER_DEFAULTS);
  });

  test('counts every concurrent increment', async () => {
    const counters = createRecordStore({
      postgres,
      id: createRecordId(),
      defaults: { retries: 0, processed: 0 },
      schema: z.object({ retries: z.number(), processed: z.number() }),
    });

    await counters.set({ retries: 5, processed: 3 });
    await Promise.all(Array.from({ length: 8 }, () => counters.incrementNumber('retries', 1)));

    await expect(counters.get()).resolves.toStrictEqual({ retries: 13, processed: 3 });
  });

  test('sets one field without losing concurrent increments or other defaults', async () => {
    const counters = createRecordStore({
      postgres,
      id: createRecordId(),
      defaults: { unread: 0, replies: 0, label: 'Counters' },
      schema: z.object({ unread: z.number(), replies: z.number(), label: z.string() }),
    });

    await counters.setNumber('unread', 4);
    await Promise.all([
      counters.setNumber('unread', 0),
      ...Array.from({ length: 16 }, () => counters.incrementNumber('replies', 1)),
    ]);

    await expect(counters.get()).resolves.toStrictEqual({
      unread: 0,
      replies: 16,
      label: 'Counters',
    });
  });

  test("rejects a stored record its schema doesn't accept, with the schema's error", async () => {
    const id = createRecordId();
    await postgres.query('INSERT INTO record_store (id, value) VALUES ($1, $2);', [
      id,
      { retries: 'many' },
    ]);

    await expect(createCounters(id).get()).rejects.toBeInstanceOf(ZodError);
  });
});
