import type { PoolClient } from 'pg';

import type { IPostgres } from '../postgres/index.js';

// validates data and returns it typed, which a Zod schema does
export type ISchema<T> = {
  parse(value: unknown): T;
};

// the keys of a record whose values are numbers
export type IRecordNumberKey<T extends Record<string, unknown>> = {
  [Key in keyof T]: T[Key] extends number ? Key : never;
}[keyof T] &
  string;

// what createRecordStore keeps
export type IRecordStoreOptions<T extends Record<string, unknown>> = {
  // the database whose record_store table holds the record
  postgres: IPostgres;

  // the record's id in the table, such as 'notifications:unread-counts'
  id: string;

  // the complete record: what get returns for a missing field, and the only keys a write keeps
  defaults: T;

  // checks the record get returns, defaults applied, such as a Zod schema. Its error propagates
  schema: ISchema<T>;
};

// one record in the record_store table. Each method takes a transaction's client, to run in it
// without committing it, or runs on the pool
export type IRecordStore<T extends Record<string, unknown>> = {
  // reads the record, with the defaults filling every missing or null field
  get: (client?: PoolClient) => Promise<T>;

  // replaces the record, with the defaults filling every undefined or null field
  set: (value: T, client?: PoolClient) => Promise<void>;

  // adds to one numeric field atomically, so concurrent increments all count
  incrementNumber: (
    field: IRecordNumberKey<T>,
    delta: number,
    client?: PoolClient,
  ) => Promise<void>;

  // replaces one numeric field, leaving the record's other fields as they are
  setNumber: (field: IRecordNumberKey<T>, value: number, client?: PoolClient) => Promise<void>;
};
