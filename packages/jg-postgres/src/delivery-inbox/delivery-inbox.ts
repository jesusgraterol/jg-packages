import { Exception } from 'jg-exception';

import { quoteIdentifier } from '../identifiers/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';
import type { IDeliveryClaim, IDeliveryInbox, IDeliveryInboxOptions } from './types.js';
import {
  assertDeliveryKey,
  assertDueLimit,
  assertKeyAndDigest,
  assertKeyAndLease,
  invalidDelivery,
  invalidInboxOptions,
  isDeliverySecondsValid,
} from './validations.js';

// a claimed row, as the claim statement returns it
type IClaimedRow = {
  delivery_key: string;
  digest: string;
  payload: unknown;
  lease_id: string | null;
  lease_expires_at: string | null;
  has_expired: boolean;
};

/**
 * Creates an inbox for deliveries an app must process exactly once, such as webhook events: it
 * stores each one before the app acknowledges it, recognizes a replay, and hands each due delivery
 * to one worker at a time under a lease. The table, whose DDL the package's README gives, is the
 * app's to create, under any name. A worker lists the due keys, claims one, processes it, and then
 * finishes it, or defers it to retry after `retrySeconds`. A lease that ends without either makes
 * the delivery due again, and a delivery still unprocessed `expirySeconds` after it was received
 * closes at its next claim. Delete processed deliveries with deleteExpiredInBatches on
 * `processed_at`, which never touches pending ones.
 * @param postgres The database.
 * @param options The table, the payload's schema, and the lease, retry, and expiry seconds.
 * @returns The inbox.
 * @example
 * import { createPostgres } from 'jg-postgres';
 * import { createDeliveryInbox } from 'jg-postgres/delivery-inbox';
 * import { z } from 'zod';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const inbox = createDeliveryInbox(postgres, {
 *   table: 'webhook_delivery',
 *   schema: z.object({ eventId: z.string() }),
 *   leaseSeconds: 600,
 *   retrySeconds: 60,
 *   expirySeconds: 86_400,
 * });
 *
 * await inbox.receive({ key: 'wh_1', digest: 'a'.repeat(64), payload: { eventId: 'evt_1' } }); // => true
 * for (const key of await inbox.listDue(32)) {
 *   const claim = await inbox.claim(key);
 *   if (claim !== null) {
 *     await inbox.finish(claim.key, claim.leaseId);
 *   }
 * }
 * @throws
 * - INVALID_DELIVERY_INBOX_OPTIONS: The delivery inbox needs a table name, a schema, whole lease, retry, and expiry seconds from 1 to 2147483647, and a due-list limit from 1 to 8192.
 * - INVALID_IDENTIFIER: The identifier is empty, holds a null character, or is longer than 63 bytes.
 */
export const createDeliveryInbox = <TPayload>(
  postgres: IPostgres,
  { table, schema, leaseSeconds, retrySeconds, expirySeconds }: IDeliveryInboxOptions<TPayload>,
): IDeliveryInbox<TPayload> => {
  if (
    typeof table !== 'string' ||
    typeof (schema as { parse?: unknown } | undefined)?.parse !== 'function' ||
    !isDeliverySecondsValid(leaseSeconds) ||
    !isDeliverySecondsValid(retrySeconds) ||
    !isDeliverySecondsValid(expirySeconds)
  ) {
    throw invalidInboxOptions();
  }
  const quotedTable = quoteIdentifier(table);

  /**
   * Checks a payload with the schema, and serializes it as JSON.
   * @param payload The payload.
   * @returns The JSON.
   * @throws
   * - INVALID_DELIVERY: The delivery needs a key of 1 to 512 characters, a lowercase hex SHA-256 digest, a payload its schema accepts, and a lease id that is a UUID.
   */
  const serializePayload = (payload: unknown): string => {
    let json: string | undefined;
    try {
      json = JSON.stringify(schema.parse(payload));
    } catch (error) {
      throw invalidDelivery(error);
    }
    if (json === undefined) {
      throw invalidDelivery();
    }
    return json;
  };

  return {
    receive: async ({ key, digest, payload }) => {
      assertKeyAndDigest(key, digest);
      const json = serializePayload(payload);
      const inserted = await postgres.pool.query(
        `INSERT INTO ${quotedTable} (delivery_key, digest, payload, due_at, expires_at)
VALUES ($1, $2, $3::jsonb, statement_timestamp(), statement_timestamp() + make_interval(secs => $4))
ON CONFLICT (delivery_key) DO NOTHING;`,
        [key, digest, json, expirySeconds],
      );
      if (inserted.rowCount === 1) {
        return true;
      }
      // a replay must carry the same body; a row retention removed since was processed already
      const [stored] = await postgres.query<{ is_same: boolean }>(
        `SELECT digest = $2 AND payload = $3::jsonb AS is_same
FROM ${quotedTable}
WHERE delivery_key = $1;`,
        [key, digest, json],
      );
      if (stored !== undefined && !stored.is_same) {
        throw new Exception(
          'A delivery with this key was already received with another digest or payload.',
          { code: ERRORS.DELIVERY_REPLAY_MISMATCH, data: { key: key.slice(0, 100) } },
        );
      }
      return false;
    },
    listDue: async (limit) => {
      assertDueLimit(limit);
      const rows = await postgres.query<{ delivery_key: string }>(
        `SELECT delivery_key
FROM ${quotedTable}
WHERE processed_at IS NULL AND due_at <= statement_timestamp()
ORDER BY due_at, delivery_key
LIMIT $1;`,
        [limit],
      );
      return rows.map(({ delivery_key: deliveryKey }) => deliveryKey);
    },
    claim: async (key) => {
      assertDeliveryKey(key);
      // a delivery past its expiry closes instead of being leased
      const [row] = await postgres.query<IClaimedRow>(
        `WITH target AS (
  SELECT delivery_key, expires_at <= statement_timestamp() AS has_expired
  FROM ${quotedTable}
  WHERE delivery_key = $1
    AND processed_at IS NULL
    AND due_at <= statement_timestamp()
    AND (lease_expires_at IS NULL OR lease_expires_at <= statement_timestamp())
  FOR UPDATE
)
UPDATE ${quotedTable} AS delivery SET
  processed_at = CASE WHEN target.has_expired THEN statement_timestamp() END,
  lease_id = CASE WHEN target.has_expired THEN NULL ELSE gen_random_uuid() END,
  lease_expires_at = CASE
    WHEN target.has_expired THEN NULL
    ELSE statement_timestamp() + make_interval(secs => $2)
  END,
  due_at = CASE
    WHEN target.has_expired THEN delivery.due_at
    ELSE statement_timestamp() + make_interval(secs => $2)
  END
FROM target
WHERE delivery.delivery_key = target.delivery_key
RETURNING delivery.delivery_key, delivery.digest, delivery.payload, delivery.lease_id,
  delivery.lease_expires_at, target.has_expired;`,
        [key, leaseSeconds],
      );
      if (row === undefined || row.has_expired) {
        return null;
      }
      const claim: IDeliveryClaim<TPayload> = {
        key: row.delivery_key,
        digest: row.digest,
        payload: schema.parse(row.payload),
        leaseId: row.lease_id as string,
        leaseExpiresAt: row.lease_expires_at as string,
      };
      return claim;
    },
    finish: async (key, leaseId) => {
      assertKeyAndLease(key, leaseId);
      const { rowCount } = await postgres.pool.query(
        `UPDATE ${quotedTable}
SET processed_at = statement_timestamp(), lease_id = NULL, lease_expires_at = NULL
WHERE delivery_key = $1
  AND lease_id = $2
  AND lease_expires_at > statement_timestamp()
  AND processed_at IS NULL;`,
        [key, leaseId],
      );
      return rowCount === 1;
    },
    defer: async (key, leaseId) => {
      assertKeyAndLease(key, leaseId);
      const { rowCount } = await postgres.pool.query(
        `UPDATE ${quotedTable}
SET due_at = LEAST(statement_timestamp() + make_interval(secs => $3), expires_at),
  lease_id = NULL,
  lease_expires_at = NULL
WHERE delivery_key = $1
  AND lease_id = $2
  AND lease_expires_at > statement_timestamp()
  AND processed_at IS NULL;`,
        [key, leaseId, retrySeconds],
      );
      return rowCount === 1;
    },
  };
};
