import type { IJsonValue } from 'jg-utilities';

import type { ITimeoutProfile } from '../timeouts/index.js';

// what createErrorLog takes
export type IErrorLogOptions = {
  // what reports the errors, such as `api` or `worker`: 1 to 256 characters
  origin: string;

  // the table the README defines, under any name. Defaults to `error_log`
  table?: string | undefined;

  // the keys whose values are replaced in an Exception's data before it's stored, at any depth and
  // whatever their case, such as `password` or `token`
  redactKeys?: readonly string[] | undefined;

  // the most characters a stored message has, with ` [truncated]` at its end once it's cut: at
  // least 16. Defaults to 8,192, the README column's size
  maxMessageLength?: number | undefined;

  // the most bytes an Exception's data takes as JSON; larger data is left out of its row: at least
  // 16. Defaults to 1,024
  maxPayloadBytes?: number | undefined;

  // the most rows one INSERT writes; a longer list is written in chunks, in one transaction: 1 to
  // 8,192. Defaults to 256
  maxBatchSize?: number | undefined;

  // the statement and lock timeouts of each write. Defaults to 5 seconds and 1 second
  timeouts?: ITimeoutProfile | undefined;

  // runs after a write that inserted rows commits, such as to count unread errors. It isn't
  // awaited, and what it throws or rejects with goes to the database's onError
  onRecorded?: ((event: IErrorLogRecordedEvent) => void | Promise<void>) | undefined;
};

// what onRecorded receives: how many rows the write inserted
export type IErrorLogRecordedEvent = {
  count: number;
};

// one error to record
export type IErrorLogEntry = {
  // the error, of any shape: its message is stored, prefixed with its code when it has one, and an
  // Exception's object data is stored as its payload
  error: unknown;

  // what reported it, when it isn't the log's origin: 1 to 256 characters
  origin?: string | undefined;

  // who was affected, such as the user's id; undefined fields are left out
  userInfo?: Record<string, IJsonValue | undefined> | null | undefined;

  // what identifies a repeat of the same failure: one row is stored per origin and key, by the
  // key's SHA-256 digest. Without it, every record is stored
  deduplicationKey?: string | undefined;
};

// records errors in a table, never rejecting
export type IErrorLog = {
  // records one error, resolving to whether a row was inserted
  record: (entry: IErrorLogEntry) => Promise<boolean>;

  // records several errors in one transaction, resolving to the rows inserted
  recordMany: (entries: readonly IErrorLogEntry[]) => Promise<number>;
};
