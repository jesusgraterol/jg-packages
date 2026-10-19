import { Exception } from 'jg-exception';

import { createAdvisoryLockKey, lockTransaction } from '../locks/index.js';
import type { IPostgres } from '../postgres/index.js';
import { ERRORS } from '../shared/index.js';

import type { IUsageAdmission, IUsageAdmissionInput } from './types.js';

/**
 * Checks whether a value is a string of 1 to a number of characters, as varchar counts them.
 * @param value The value.
 * @param maxLength The most characters.
 * @returns Whether it is.
 */
const isBoundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === 'string' && value.length > 0 && Array.from(value).length <= maxLength;

/**
 * Checks whether a value is a positive, finite number of seconds.
 * @param value The value.
 * @returns Whether it is.
 */
const isPositiveSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Ensures an admission's input is valid.
 * @param input The input.
 * @throws
 * - INVALID_USAGE_ADMISSION: The usage admission needs an actor id of 1 to 256 characters, an action id of 1 to 128, a scope key of 1 to 256 when given, a whole positive limit, and positive seconds, with a cooldown only for a scope.
 */
const assertInput = ({
  actorId,
  actionId,
  scopeKey,
  limit,
  windowSeconds,
  cooldownSeconds,
}: IUsageAdmissionInput): void => {
  if (
    !isBoundedString(actorId, 256) ||
    !isBoundedString(actionId, 128) ||
    (scopeKey !== undefined && !isBoundedString(scopeKey, 256)) ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !isPositiveSeconds(windowSeconds) ||
    (cooldownSeconds !== undefined &&
      (!isPositiveSeconds(cooldownSeconds) || scopeKey === undefined))
  ) {
    throw new Exception(
      'The usage admission needs an actor id of 1 to 256 characters, an action id of 1 to 128, a scope key of 1 to 256 when given, a whole positive limit, and positive seconds, with a cooldown only for a scope.',
      { code: ERRORS.INVALID_USAGE_ADMISSION },
    );
  }
};

/**
 * Decides, atomically, whether an actor may do a rate-limited action now, such as sending an
 * invitation, and records it when they may. It refuses with `cooldown` while the same action on
 * the same scope was accepted less than `cooldownSeconds` ago, by any actor, and with `limit` once
 * the actor did the action `limit` times within `windowSeconds`. Concurrent calls queue on
 * transaction advisory locks, the scope's then the actor's, so they never both pass, and every
 * comparison uses the database's clock. It needs the `usage_event` table the README defines.
 * @param postgres The database.
 * @param input The actor, the action, the optional scope, the limit and its window, and the
 * optional cooldown.
 * @returns A promise that resolves to the outcome, with `retryAt`, an ISO 8601 UTC timestamp: when
 * the scope's cooldown ends, or null without one.
 * @example
 * import { admitUsage, createPostgres } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const admission = await admitUsage(postgres, {
 *   actorId: '42',
 *   actionId: 'send-invitation',
 *   scopeKey: 'invitee@example.com',
 *   limit: 20,
 *   windowSeconds: 86_400,
 *   cooldownSeconds: 60,
 * });
 * if (admission.outcome !== 'accepted') {
 *   // tell the user when to try again: admission.retryAt, or tomorrow for 'limit'
 * }
 * @throws
 * - INVALID_USAGE_ADMISSION: The usage admission needs an actor id of 1 to 256 characters, an action id of 1 to 128, a scope key of 1 to 256 when given, a whole positive limit, and positive seconds, with a cooldown only for a scope.
 */
export const admitUsage = (
  postgres: IPostgres,
  input: IUsageAdmissionInput,
): Promise<IUsageAdmission> => {
  assertInput(input);
  const { actorId, actionId, scopeKey, limit, windowSeconds, cooldownSeconds } = input;
  return postgres.transaction(async (client): Promise<IUsageAdmission> => {
    if (cooldownSeconds !== undefined) {
      await lockTransaction(
        client,
        createAdvisoryLockKey(`jg-postgres:usage-scope:${actionId}:${String(scopeKey)}`),
      );
      const { rows: recent } = await client.query<{ retry_at: string }>(
        `SELECT created_at + make_interval(secs => $3) AS retry_at
        FROM usage_event
        WHERE action_id = $1
          AND scope_key = $2
          AND created_at > clock_timestamp() - make_interval(secs => $3)
        ORDER BY created_at DESC
        LIMIT 1;`,
        [actionId, scopeKey, cooldownSeconds],
      );
      if (recent[0] !== undefined) {
        return { outcome: 'cooldown', retryAt: recent[0].retry_at };
      }
    }
    await lockTransaction(
      client,
      createAdvisoryLockKey(`jg-postgres:usage-actor:${actionId}:${actorId}`),
    );
    const { rows: usage } = await client.query<{ usage_count: number }>(
      `SELECT count(*)::integer AS usage_count
      FROM usage_event
      WHERE actor_id = $1
        AND action_id = $2
        AND created_at > clock_timestamp() - make_interval(secs => $3);`,
      [actorId, actionId, windowSeconds],
    );
    // count(*) always gives one row
    const [{ usage_count: usageCount }] = usage as [{ usage_count: number }];
    if (usageCount >= limit) {
      return { outcome: 'limit', retryAt: null };
    }
    // clock_timestamp(), not the column's now(), which is when the transaction started, before
    // any wait for the locks
    const { rows: inserted } = await client.query<{ retry_at: string }>(
      `INSERT INTO usage_event (actor_id, action_id, scope_key, created_at)
      VALUES ($1, $2, $3, clock_timestamp())
      RETURNING created_at + make_interval(secs => $4) AS retry_at;`,
      [actorId, actionId, scopeKey ?? null, cooldownSeconds ?? 0],
    );
    // RETURNING gives the one inserted row
    const [{ retry_at: retryAt }] = inserted as [{ retry_at: string }];
    return { outcome: 'accepted', retryAt: cooldownSeconds === undefined ? null : retryAt };
  });
};
