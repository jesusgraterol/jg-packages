// @vitest-environment node
import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import type { IPostgres } from '../postgres/index.js';
import { deleteExpiredInBatches } from '../retention/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestPostgres, createTableName } from '../test-utils/database.js';
import { createDeliveryInbox } from './delivery-inbox.js';
import type { IDeliveryInbox } from './types.js';

const PayloadSchema = z.object({
  eventId: z.string(),
  attempt: z.number().default(1),
});
type IPayload = z.infer<typeof PayloadSchema>;

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);

let postgres: IPostgres;

beforeAll(() => {
  postgres = connectTestPostgres({ max: 10 });
});

afterAll(async () => {
  await postgres.close();
});

/**
 * Creates an inbox table with the README's DDL, under a name no other test uses.
 * @returns A promise that resolves to the table's name.
 */
const createInboxTable = async (): Promise<string> => {
  const table = createTableName('delivery');
  await postgres.query(`CREATE TABLE ${table} (
  delivery_key varchar(512) NOT NULL,
  digest char(64) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  due_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  lease_id uuid NULL,
  lease_expires_at timestamptz NULL,
  processed_at timestamptz NULL,
  CONSTRAINT pk_${table}__delivery_key PRIMARY KEY (delivery_key),
  CONSTRAINT chk_${table}__delivery_key_non_empty CHECK (delivery_key <> ''),
  CONSTRAINT chk_${table}__digest_sha256 CHECK (digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_${table}__expires_at_chronological CHECK (expires_at > created_at),
  CONSTRAINT chk_${table}__processed_at_chronological
    CHECK (processed_at IS NULL OR processed_at >= created_at),
  CONSTRAINT chk_${table}__lease_complete CHECK ((lease_id IS NULL) = (lease_expires_at IS NULL)),
  CONSTRAINT chk_${table}__processed_without_lease CHECK (processed_at IS NULL OR lease_id IS NULL)
);`);
  await postgres.query(
    `CREATE INDEX idx_${table}__due_at_delivery_key_pending ON ${table} (due_at, delivery_key) WHERE processed_at IS NULL;`,
  );
  await postgres.query(
    `CREATE INDEX idx_${table}__processed_at_delivery_key_processed ON ${table} (processed_at, delivery_key) WHERE processed_at IS NOT NULL;`,
  );
  return table;
};

/**
 * Creates an inbox over a new table.
 * @param seconds The lease, retry, and expiry seconds to change.
 * @returns A promise that resolves to the inbox and its table.
 */
const createInbox = async (
  seconds: Partial<Record<'leaseSeconds' | 'retrySeconds' | 'expirySeconds', number>> = {},
): Promise<{ inbox: IDeliveryInbox<IPayload>; table: string }> => {
  const table = await createInboxTable();
  const inbox = createDeliveryInbox(postgres, {
    table,
    schema: PayloadSchema,
    leaseSeconds: 600,
    retrySeconds: 60,
    expirySeconds: 86_400,
    ...seconds,
  });
  return { inbox, table };
};

/**
 * Reads a delivery's row.
 * @param table The table.
 * @param key The delivery's key.
 * @returns A promise that resolves to the row's state.
 */
const readRow = async (table: string, key: string) =>
  (
    await postgres.query<{
      due_in_seconds: number;
      expires_at: string;
      due_at: string;
      lease_id: string | null;
      processed_at: string | null;
    }>(
      `SELECT extract(epoch FROM due_at - statement_timestamp())::float AS due_in_seconds,
        expires_at, due_at, lease_id, processed_at
      FROM ${table} WHERE delivery_key = $1;`,
      [key],
    )
  )[0];

/**
 * Moves a delivery's times back, as if they had passed.
 * @param table The table.
 * @param key The delivery's key.
 * @param assignments The SQL assignments, such as `due_at = due_at - interval '1 hour'`.
 */
const rewind = async (table: string, key: string, assignments: string): Promise<void> => {
  await postgres.query(
    `UPDATE ${table} SET created_at = created_at - interval '30 days', ${assignments} WHERE delivery_key = $1;`,
    [key],
  );
};

describe('createDeliveryInbox', () => {
  test('stores a new delivery, and recognizes its replay, whatever the key order', async () => {
    const { inbox, table } = await createInbox();

    await expect(
      inbox.receive({ key: 'wh_1', digest: DIGEST_A, payload: { eventId: 'evt_1', attempt: 2 } }),
    ).resolves.toBe(true);
    await expect(
      inbox.receive({
        key: 'wh_1',
        digest: DIGEST_A,
        payload: { attempt: 2, eventId: 'evt_1' },
      }),
    ).resolves.toBe(false);
    expect(await postgres.query(`SELECT delivery_key FROM ${table};`)).toStrictEqual([
      { delivery_key: 'wh_1' },
    ]);
  });

  test.each([
    ['another digest', { digest: DIGEST_B, payload: { eventId: 'evt_1' } }],
    ['another payload', { digest: DIGEST_A, payload: { eventId: 'evt_2' } }],
  ])('refuses a replay with %s', async (_, delivery) => {
    const { inbox } = await createInbox();
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });

    await expectToRejectCode(
      inbox.receive({ key: 'wh_1', ...delivery } as never),
      ERRORS.DELIVERY_REPLAY_MISMATCH,
      'A delivery with this key was already received with another digest or payload.',
    );
  });

  test('lists the due deliveries oldest first, by key on a tie, up to the limit', async () => {
    const { inbox, table } = await createInbox();
    for (const key of ['c', 'a', 'b', 'd', 'e']) {
      await inbox.receive({ key, digest: DIGEST_A, payload: { eventId: key, attempt: 1 } });
    }
    await postgres.query(
      `UPDATE ${table} SET due_at = statement_timestamp() - interval '1 hour' WHERE delivery_key IN ('a', 'b', 'c');`,
    );
    await postgres.query(
      `UPDATE ${table} SET due_at = statement_timestamp() - interval '2 hours' WHERE delivery_key = 'd';`,
    );
    await postgres.query(
      `UPDATE ${table} SET due_at = statement_timestamp() + interval '1 hour' WHERE delivery_key = 'e';`,
    );

    await expect(inbox.listDue(8)).resolves.toStrictEqual(['d', 'a', 'b', 'c']);
    await expect(inbox.listDue(2)).resolves.toStrictEqual(['d', 'a']);
  });

  test('claims a due delivery with a lease, which keeps it from every other claim', async () => {
    const { inbox, table } = await createInbox({ leaseSeconds: 300 });
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1' } as IPayload,
    });

    const claim = await inbox.claim('wh_1');

    expect(claim).toMatchObject({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
      leaseId: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
    });
    expect(Date.parse(claim?.leaseExpiresAt ?? '') - Date.now()).toBeGreaterThan(290_000);
    expect((await readRow(table, 'wh_1'))?.due_in_seconds).toBeGreaterThan(290);
    await expect(inbox.claim('wh_1')).resolves.toBeNull();
    await expect(inbox.listDue(8)).resolves.toStrictEqual([]);
  });

  test('lets exactly one of several concurrent claims take a delivery', async () => {
    const { inbox } = await createInbox();
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });

    const claims = await Promise.all(Array.from({ length: 8 }, () => inbox.claim('wh_1')));

    expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
  });

  test('lets another claim take a delivery once its lease ends, fencing out the old lease', async () => {
    const { inbox, table } = await createInbox();
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });
    const first = await inbox.claim('wh_1');
    await rewind(
      table,
      'wh_1',
      "due_at = statement_timestamp() - interval '1 second', lease_expires_at = statement_timestamp() - interval '1 second'",
    );

    await expect(inbox.listDue(8)).resolves.toStrictEqual(['wh_1']);
    const second = await inbox.claim('wh_1');

    expect(second?.leaseId).not.toBe(first?.leaseId);
    await expect(inbox.finish('wh_1', first?.leaseId ?? '')).resolves.toBe(false);
    await expect(inbox.finish('wh_1', second?.leaseId ?? '')).resolves.toBe(true);
  });

  test('closes a delivery claimed after its expiry', async () => {
    const { inbox, table } = await createInbox();
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });
    await rewind(table, 'wh_1', "expires_at = statement_timestamp() - interval '1 second'");

    await expect(inbox.claim('wh_1')).resolves.toBeNull();
    expect(await readRow(table, 'wh_1')).toMatchObject({
      lease_id: null,
      processed_at: expect.any(String) as unknown,
    });
    await expect(inbox.listDue(8)).resolves.toStrictEqual([]);
  });

  test('finishes a delivery only under its current lease', async () => {
    const { inbox, table } = await createInbox();
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });
    const claim = await inbox.claim('wh_1');

    await expect(inbox.finish('wh_1', '00000000-0000-4000-8000-000000000000')).resolves.toBe(false);
    await expect(inbox.finish('wh_1', claim?.leaseId ?? '')).resolves.toBe(true);
    await expect(inbox.finish('wh_1', claim?.leaseId ?? '')).resolves.toBe(false);
    expect(await readRow(table, 'wh_1')).toMatchObject({ lease_id: null });
    expect((await readRow(table, 'wh_1'))?.processed_at).not.toBeNull();
    await expect(inbox.claim('wh_1')).resolves.toBeNull();
  });

  test('defers a delivery under its lease by retrySeconds, never past its expiry', async () => {
    const { inbox, table } = await createInbox({ retrySeconds: 120 });
    await inbox.receive({
      key: 'wh_1',
      digest: DIGEST_A,
      payload: { eventId: 'evt_1', attempt: 1 },
    });
    await inbox.receive({
      key: 'wh_2',
      digest: DIGEST_A,
      payload: { eventId: 'evt_2', attempt: 1 },
    });
    await postgres.query(
      `UPDATE ${table} SET expires_at = statement_timestamp() + interval '30 seconds' WHERE delivery_key = 'wh_2';`,
    );
    const first = await inbox.claim('wh_1');
    const second = await inbox.claim('wh_2');

    await expect(inbox.defer('wh_1', '00000000-0000-4000-8000-000000000000')).resolves.toBe(false);
    await expect(inbox.defer('wh_1', first?.leaseId ?? '')).resolves.toBe(true);
    await expect(inbox.defer('wh_2', second?.leaseId ?? '')).resolves.toBe(true);
    await expect(inbox.defer('wh_1', first?.leaseId ?? '')).resolves.toBe(false);

    const deferred = await readRow(table, 'wh_1');
    expect(deferred).toMatchObject({ lease_id: null, processed_at: null });
    expect(deferred?.due_in_seconds).toBeGreaterThan(110);
    expect(deferred?.due_in_seconds).toBeLessThanOrEqual(120);
    const capped = await readRow(table, 'wh_2');
    expect(capped?.due_at).toBe(capped?.expires_at);
    await expect(inbox.listDue(8)).resolves.toStrictEqual([]);
  });

  test('deletes processed deliveries past retention on processed_at, keeping pending ones', async () => {
    const { inbox, table } = await createInbox();
    for (const key of ['done_1', 'done_2', 'done_3', 'pending_1', 'pending_2', 'recent']) {
      await inbox.receive({ key, digest: DIGEST_A, payload: { eventId: key, attempt: 1 } });
    }
    for (const key of ['done_1', 'done_2', 'done_3', 'recent']) {
      const claim = await inbox.claim(key);
      await inbox.finish(key, claim?.leaseId ?? '');
    }
    await postgres.query(
      `UPDATE ${table}
      SET created_at = created_at - interval '30 days',
        processed_at = processed_at - interval '8 days'
      WHERE delivery_key LIKE 'done_%';`,
    );
    await postgres.query(
      `UPDATE ${table} SET created_at = created_at - interval '30 days' WHERE delivery_key LIKE 'pending_%';`,
    );

    const { deletedCount } = await deleteExpiredInBatches(postgres, {
      table,
      timestampColumn: 'processed_at',
      keyColumn: 'delivery_key',
      olderThan: { days: 7 },
      batchSize: 2,
    });

    expect(deletedCount).toBe(3);
    expect(
      (
        await postgres.query<{ delivery_key: string }>(
          `SELECT delivery_key FROM ${table} ORDER BY delivery_key;`,
        )
      ).map(({ delivery_key: key }) => key),
    ).toStrictEqual(['pending_1', 'pending_2', 'recent']);
  });

  test.each([
    ['an empty key', { key: '', digest: DIGEST_A, payload: { eventId: 'e' } }],
    [
      'a key over 512 characters',
      { key: 'k'.repeat(513), digest: DIGEST_A, payload: { eventId: 'e' } },
    ],
    ['an uppercase digest', { key: 'k', digest: 'A'.repeat(64), payload: { eventId: 'e' } }],
    ['a short digest', { key: 'k', digest: 'a'.repeat(63), payload: { eventId: 'e' } }],
    ['a payload the schema refuses', { key: 'k', digest: DIGEST_A, payload: { eventId: 7 } }],
  ])('refuses %s with INVALID_DELIVERY', async (_, delivery) => {
    const { inbox, table } = await createInbox();

    await expectToRejectCode(
      inbox.receive(delivery as never),
      ERRORS.INVALID_DELIVERY,
      'The delivery needs a key of 1 to 512 characters',
    );
    expect(await postgres.query(`SELECT 1 FROM ${table};`)).toStrictEqual([]);
  });

  test('refuses a payload the schema turns into nothing JSON can hold', async () => {
    const table = await createInboxTable();
    const inbox = createDeliveryInbox(postgres, {
      table,
      schema: { parse: () => undefined },
      leaseSeconds: 60,
      retrySeconds: 60,
      expirySeconds: 60,
    });

    await expectToRejectCode(
      inbox.receive({ key: 'k', digest: DIGEST_A, payload: undefined }),
      ERRORS.INVALID_DELIVERY,
    );
  });

  test.each([
    ['claim', (inbox: IDeliveryInbox<IPayload>) => inbox.claim('')],
    ['finish', (inbox: IDeliveryInbox<IPayload>) => inbox.finish('k', 'not-a-uuid')],
    ['defer', (inbox: IDeliveryInbox<IPayload>) => inbox.defer('', DIGEST_A)],
  ])('refuses an invalid key or lease in %s with INVALID_DELIVERY', async (_, call) => {
    const { inbox } = await createInbox();

    await expectToRejectCode(call(inbox), ERRORS.INVALID_DELIVERY);
  });

  test.each([[0], [8_193], [1.5]])(
    'refuses a due-list limit of %d with INVALID_DELIVERY_INBOX_OPTIONS',
    async (limit) => {
      const { inbox } = await createInbox();

      await expectToRejectCode(inbox.listDue(limit), ERRORS.INVALID_DELIVERY_INBOX_OPTIONS);
    },
  );

  test.each([
    ['no schema', { schema: undefined }],
    ['a lease of 0 seconds', { leaseSeconds: 0 }],
    ['a fractional retry', { retrySeconds: 1.5 }],
    ['an expiry past the interval range', { expirySeconds: 2_147_483_648 }],
    ['a table that is not a string', { table: 42 }],
  ])('refuses %s with INVALID_DELIVERY_INBOX_OPTIONS', (_, override) => {
    expectToThrowCode(
      () =>
        createDeliveryInbox(postgres, {
          table: 'webhook_delivery',
          schema: PayloadSchema,
          leaseSeconds: 60,
          retrySeconds: 60,
          expirySeconds: 60,
          ...override,
        } as never),
      ERRORS.INVALID_DELIVERY_INBOX_OPTIONS,
      'The delivery inbox needs a table name',
    );
  });

  test('refuses a table name PostgreSQL would cut short with INVALID_IDENTIFIER', () => {
    expectToThrowCode(
      () =>
        createDeliveryInbox(postgres, {
          table: 't'.repeat(64),
          schema: PayloadSchema,
          leaseSeconds: 60,
          retrySeconds: 60,
          expirySeconds: 60,
        }),
      ERRORS.INVALID_IDENTIFIER,
    );
  });
});
