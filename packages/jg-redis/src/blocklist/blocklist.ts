import { randomUUID } from 'node:crypto';

import { Exception } from 'jg-exception';

import type { IRedis } from '../connection/index.js';
import { ERRORS } from '../shared/index.js';

import type { IBlocklist, IBlocklistOptions } from './types.js';

// the most values one SADD or SREM sends, so a large list never becomes one huge command
const CHUNK_SIZE = 1_000;

// the most characters a value may have, such as an IPv6 address or a domain, with headroom
const MAX_VALUE_LENGTH = 512;

/*
 * The seconds a staging set lives while replaceAll fills it, refreshed with every chunk, so one
 * a crashed process left behind expires. An hour is far longer than filling any list takes.
 */
const STAGING_TTL_SECONDS = 3_600;

/**
 * Builds the exception for a Redis command that failed.
 * @param error The command's error.
 * @returns The BLOCKLIST_FAILED exception.
 */
const blocklistFailed = (error: unknown): Exception =>
  new Exception('Redis could not complete the blocklist command.', {
    code: ERRORS.BLOCKLIST_FAILED,
    cause: error,
  });

/**
 * Checks whether a value is a string of 1 to 512 characters.
 * @param value The value.
 * @returns Whether it is.
 */
const isValueValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_VALUE_LENGTH;

/**
 * Builds the exception for a value, or a list of values, that isn't valid.
 * @returns The BLOCKLIST_VALUE_INVALID exception.
 */
const valueInvalid = (): Exception =>
  new Exception('Each blocklist value must be a string of 1 to 512 characters.', {
    code: ERRORS.BLOCKLIST_VALUE_INVALID,
  });

/**
 * Ensures a value is a list of strings of 1 to 512 characters.
 * @param values The value.
 * @throws
 * - BLOCKLIST_VALUE_INVALID: Each blocklist value must be a string of 1 to 512 characters.
 */
const assertValueList = (values: unknown): void => {
  if (!Array.isArray(values) || !values.every(isValueValid)) {
    throw valueInvalid();
  }
};

/**
 * Splits values into chunks of at most CHUNK_SIZE.
 * @param values The values.
 * @returns The chunks, none of them empty.
 */
const toChunks = (values: readonly string[]): string[][] =>
  Array.from({ length: Math.ceil(values.length / CHUNK_SIZE) }, (_, index) =>
    values.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
  );

/**
 * Runs Redis commands, turning any failure into BLOCKLIST_FAILED.
 * @param run The commands.
 * @returns A promise that resolves to their result.
 * @throws
 * - BLOCKLIST_FAILED: Redis could not complete the blocklist command.
 */
const runCommands = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw blocklistFailed(error);
  }
};

/**
 * Creates a list of blocked values, such as IP addresses, in one Redis SET. Values are compared
 * exactly, so normalize them the same way when adding and checking. The list never expires, so a
 * flush or an eviction empties it: keep the authoritative list in a database and restore it with
 * replaceAll, at boot or on a schedule. Every command failure throws BLOCKLIST_FAILED, with the
 * cause, so a caller can fail closed.
 * @param redis The client.
 * @param options The key of the SET.
 * @returns The list.
 * @example
 * import { connectRedis, createBlocklist } from 'jg-redis';
 *
 * declare const redis: Awaited<ReturnType<typeof connectRedis>>;
 *
 * const ipBlocklist = createBlocklist(redis, { key: 'ip-blocklist' });
 * await ipBlocklist.add(['203.0.113.7']);
 * await ipBlocklist.has('203.0.113.7'); // true
 * await ipBlocklist.replaceAll(['198.51.100.1', '198.51.100.2']); // 203.0.113.7 is gone
 * @throws
 * - INVALID_BLOCKLIST_KEY: The blocklist key must be a non-empty string.
 */
export const createBlocklist = (redis: IRedis, { key }: IBlocklistOptions): IBlocklist => {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Exception('The blocklist key must be a non-empty string.', {
      code: ERRORS.INVALID_BLOCKLIST_KEY,
    });
  }

  return {
    has: async (value) => {
      if (!isValueValid(value)) {
        throw valueInvalid();
      }
      return (await runCommands(() => redis.client.sIsMember(key, value))) === 1;
    },
    add: async (values) => {
      assertValueList(values);
      await runCommands(async () => {
        for (const chunk of toChunks(values)) {
          await redis.client.sAdd(key, chunk);
        }
      });
    },
    remove: async (values) => {
      assertValueList(values);
      await runCommands(async () => {
        for (const chunk of toChunks(values)) {
          await redis.client.sRem(key, chunk);
        }
      });
    },
    replaceAll: async (values) => {
      assertValueList(values);
      await runCommands(async () => {
        if (values.length === 0) {
          await redis.client.del(key);
          return;
        }
        const stagingKey = `${key}:replace:${randomUUID()}`;
        for (const chunk of toChunks(values)) {
          await redis.client
            .multi()
            .sAdd(stagingKey, chunk)
            .expire(stagingKey, STAGING_TTL_SECONDS)
            .exec();
        }
        // PERSIST first, since RENAME would carry the staging key's expiry over to the list
        await redis.client.multi().persist(stagingKey).rename(stagingKey, key).exec();
      });
    },
  };
};
