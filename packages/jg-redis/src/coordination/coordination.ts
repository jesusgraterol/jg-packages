import { createHash } from 'node:crypto';

import { Exception } from 'jg-exception';

import type { IRedis } from '../connection/index.js';
import { ERRORS, type ISchema } from '../shared/index.js';
import { assertTtl } from '../shared/utilities.js';

/**
 * Builds the error for a Redis command coordination couldn't complete, so the caller fails
 * closed instead of carrying on as if it had.
 * @param error The client's error.
 * @returns The error.
 */
const buildFailure = (error: unknown): Exception =>
  new Exception('Redis could not complete the coordination command.', {
    code: ERRORS.COORDINATION_FAILED,
    cause: error,
  });

/**
 * Claims a token once, such as a one-time code that must not be replayed: the first call for a
 * token in its namespace succeeds, and every other call until the time-to-live ends doesn't. The
 * token is stored only as its SHA-256 hash, under `<namespace>:<hash>`. A Redis error throws
 * instead of letting the token through.
 * @param redis The client, from connectRedis.
 * @param namespace The key's prefix, such as `user:42:used-otp`.
 * @param token The token to claim.
 * @param ttlSeconds How long the claim lasts, in whole seconds: at least as long as the token
 * stays valid.
 * @returns A promise that resolves to whether this call made the claim.
 * @example
 * import { connectRedis } from 'jg-redis';
 * import { claimOnce } from 'jg-redis/coordination';
 *
 * declare const redis: Awaited<ReturnType<typeof connectRedis>>;
 *
 * if (!(await claimOnce(redis, 'user:42:used-otp', '123456', 90))) {
 *   // the code was already used
 * }
 * @throws
 * - INVALID_TTL: The time-to-live must be a whole number of seconds, from 1.
 * - COORDINATION_FAILED: Redis could not complete the coordination command.
 */
export const claimOnce = async (
  redis: IRedis,
  namespace: string,
  token: string,
  ttlSeconds: number,
): Promise<boolean> => {
  assertTtl(ttlSeconds);
  const key = `${namespace}:${createHash('sha256').update(token).digest('hex')}`;
  try {
    return (await redis.client.set(key, '1', { NX: true, EX: ttlSeconds })) === 'OK';
  } catch (error) {
    throw buildFailure(error);
  }
};

/**
 * Stores a value that one later call takes, such as a sign-in challenge's record. Name the key
 * after a hash of any token it's looked up by, never the token itself.
 * @param redis The client, from connectRedis.
 * @param key The key, such as `user-auth:sign-in-challenge:<token hash>`.
 * @param value The value, stored as JSON.
 * @param ttlSeconds How long it can be taken, in whole seconds.
 * @returns A promise that resolves once it's stored.
 * @example
 * import { connectRedis } from 'jg-redis';
 * import { storeSingleUseValue } from 'jg-redis/coordination';
 *
 * declare const redis: Awaited<ReturnType<typeof connectRedis>>;
 *
 * await storeSingleUseValue(redis, 'user-auth:challenge:9f86d081', { userId: '42' }, 300);
 * @throws
 * - INVALID_TTL: The time-to-live must be a whole number of seconds, from 1.
 * - COORDINATION_FAILED: Redis could not complete the coordination command.
 */
export const storeSingleUseValue = async (
  redis: IRedis,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> => {
  assertTtl(ttlSeconds);
  try {
    await redis.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (error) {
    throw buildFailure(error);
  }
};

/**
 * Takes a single-use value: reads and deletes it in one command, so of any concurrent calls, one
 * gets it and the rest get null. A value that fails its schema is already deleted, so it throws
 * COORDINATION_VALUE_INVALID, without a cause or the value, which might hold a secret.
 * @param redis The client, from connectRedis.
 * @param key The value's key.
 * @param schema Checks the value, such as a Zod schema.
 * @returns A promise that resolves to the value, or null when it's missing, taken, or expired.
 * @example
 * import { connectRedis } from 'jg-redis';
 * import { takeSingleUseValue } from 'jg-redis/coordination';
 * import { z } from 'zod';
 *
 * declare const redis: Awaited<ReturnType<typeof connectRedis>>;
 *
 * const challenge = await takeSingleUseValue(
 *   redis,
 *   'user-auth:challenge:9f86d081',
 *   z.object({ userId: z.string() }),
 * );
 * @throws
 * - COORDINATION_FAILED: Redis could not complete the coordination command.
 * - COORDINATION_VALUE_INVALID: The single-use value is not valid JSON or does not match its schema.
 */
export const takeSingleUseValue = async <T>(
  redis: IRedis,
  key: string,
  schema: ISchema<T>,
): Promise<T | null> => {
  let text: string | null;
  try {
    text = await redis.client.getDel(key);
  } catch (error) {
    throw buildFailure(error);
  }
  if (text === null) {
    return null;
  }
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new Exception('The single-use value is not valid JSON or does not match its schema.', {
      code: ERRORS.COORDINATION_VALUE_INVALID,
      data: { key },
    });
  }
};
