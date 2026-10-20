import type { ISchema } from '../shared/index.js';

// what createDeliveryInbox takes
export type IDeliveryInboxOptions<TPayload> = {
  // the table the README's DDL defines, under any name
  table: string;

  // checks a delivery's payload when it's received and when it's claimed, such as a Zod schema
  schema: ISchema<TPayload>;

  // how long a claim holds a delivery, in seconds, before another claim can take it
  leaseSeconds: number;

  // how long a deferred delivery waits before it's due again, in seconds
  retrySeconds: number;

  // how long after it's received a delivery may still be claimed, in seconds. A claim after that
  // closes it instead
  expirySeconds: number;
};

// a delivery as received: its key, a SHA-256 of its body, and what processing it needs
export type IDelivery<TPayload> = {
  // the provider's identifier for the delivery, such as a webhook id, 1 to 512 characters
  key: string;

  // the lowercase hex SHA-256 of the delivery's body, which tells a replay from a different
  // delivery under the same key
  digest: string;

  // what processing the delivery needs, such as the ids the event names, stored as JSON
  payload: TPayload;
};

// a delivery claimed for processing, with the lease that finishes or defers it
export type IDeliveryClaim<TPayload> = IDelivery<TPayload> & {
  // the lease's id, which finish and defer take
  leaseId: string;

  // when the lease ends and another claim can take the delivery, as an ISO 8601 UTC timestamp
  leaseExpiresAt: string;
};

// a table of received deliveries, each processed once, by whoever holds its lease
export type IDeliveryInbox<TPayload> = {
  // stores a delivery, resolving to true when it's new and false for a replay of one received
  // before with the same digest and payload
  receive: (delivery: IDelivery<TPayload>) => Promise<boolean>;

  // the keys of the deliveries due for processing, oldest due first, at most `limit`, from 1 to
  // 8,192
  listDue: (limit: number) => Promise<string[]>;

  /*
   * Takes a lease on a due delivery, resolving to it, or to null when it isn't due, is leased, was
   * processed, or has expired, which closes it. Its payload goes through the schema again, and a
   * stored payload the schema now refuses throws the schema's error.
   */
  claim: (key: string) => Promise<IDeliveryClaim<TPayload> | null>;

  // marks a delivery processed, resolving to whether the lease still held it
  finish: (key: string, leaseId: string) => Promise<boolean>;

  // gives a delivery back to be retried after retrySeconds, never later than its expiry,
  // resolving to whether the lease still held it
  defer: (key: string, leaseId: string) => Promise<boolean>;
};
