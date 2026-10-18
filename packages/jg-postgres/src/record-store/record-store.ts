import type { PoolClient } from 'pg';

import { applyDefaults } from 'jg-utilities';

import type { IRecordStore, IRecordStoreOptions } from './types.js';

/**
 * Creates a store for one JSON record, such as a set of counters or a feature's settings, kept
 * in the record_store table the package's README describes, which the app creates. The defaults
 * fill every missing field when it's read, and are the only keys a write keeps. Every read is
 * checked with the schema. A method given a transaction's client runs in it, and never commits
 * it.
 * @param options The database, the record's id, its defaults, and its schema.
 * @returns The record's store.
 * @example
 * import { createPostgres } from 'jg-postgres';
 * import { createRecordStore } from 'jg-postgres/record-store';
 * import { z } from 'zod';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const counters = createRecordStore({
 *   postgres,
 *   id: 'admin:unread-counts',
 *   defaults: { notifications: 0, reports: 0 },
 *   schema: z.object({ notifications: z.number(), reports: z.number() }),
 * });
 *
 * await counters.incrementNumber('notifications', 1);
 * await counters.get(); // => { notifications: 1, reports: 0 }
 */
export const createRecordStore = <T extends Record<string, unknown>>({
  postgres,
  id,
  defaults,
  schema,
}: IRecordStoreOptions<T>): IRecordStore<T> => {
  const executorOf = (client: PoolClient | undefined): Pick<PoolClient, 'query'> =>
    client ?? postgres.pool;

  return {
    get: async (client) => {
      const { rows } = await executorOf(client).query<{ value: Partial<T> }>(
        'SELECT value FROM record_store WHERE id = $1;',
        [id],
      );
      const [row] = rows;
      return schema.parse(row === undefined ? defaults : applyDefaults(defaults, row.value));
    },
    set: async (value, client) => {
      await executorOf(client).query(
        `INSERT INTO record_store (id, value)
           VALUES ($1, $2)
           ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;`,
        [id, applyDefaults(defaults, value)],
      );
    },
    incrementNumber: async (field, delta, client) => {
      // the stored value wins over the default, and the sum stays exact as BIGINT
      await executorOf(client).query(
        `INSERT INTO record_store (id, value)
           VALUES (
             $1,
             jsonb_set(
               $4::jsonb,
               ARRAY[$2::text],
               to_jsonb(COALESCE(($4::jsonb ->> $2::text)::bigint, 0) + $3::bigint),
               true
             )
           )
           ON CONFLICT (id) DO UPDATE SET
             value = jsonb_set(
               $4::jsonb || record_store.value,
               ARRAY[$2::text],
               to_jsonb(
                 COALESCE(
                   (record_store.value ->> $2::text)::bigint,
                   ($4::jsonb ->> $2::text)::bigint,
                   0
                 ) + $3::bigint
               ),
               true
             );`,
        [id, field, delta, defaults],
      );
    },
    setNumber: async (field, value, client) => {
      await executorOf(client).query(
        `INSERT INTO record_store (id, value)
           VALUES ($1, jsonb_set($4::jsonb, ARRAY[$2::text], to_jsonb($3::bigint), true))
           ON CONFLICT (id) DO UPDATE SET
             value = jsonb_set($4::jsonb || record_store.value, ARRAY[$2::text], to_jsonb($3::bigint), true);`,
        [id, field, value, defaults],
      );
    },
  };
};
