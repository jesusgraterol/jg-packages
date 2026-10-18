import { createClient } from 'redis';

import type { IRedis, IRedisOptions } from './types.js';

// how long connecting may take before it fails, unless the options say otherwise
const CONNECT_TIMEOUT_MS = 10_000;

// each client's onError, which the package's cache reports to
const ERROR_REPORTERS = new WeakMap<IRedis, (error: unknown) => void>();

/**
 * Reads where a client's helpers report errors no caller awaits.
 * @param redis The client, from connectRedis.
 * @returns Its onError, or console.error.
 */
export const getErrorReporter = (redis: IRedis): ((error: unknown) => void) =>
  ERROR_REPORTERS.get(redis) ?? ((error: unknown): void => console.error(error));

/**
 * Connects a Redis client that's safe to share: its errors go to onError instead of crashing the
 * process, a command sent while disconnected is rejected instead of queued and replayed later,
 * and connecting gives up after 10 seconds unless the socket options set another timeout.
 * Closing it waits for pending replies and never flushes any data.
 * @param options node-redis's client options, plus onError.
 * @returns A promise that resolves to the connected client.
 * @example
 * import { connectRedis } from 'jg-redis';
 *
 * const redis = await connectRedis({
 *   socket: { host: 'localhost', port: 6379 },
 *   password: 'secret',
 *   onError: (error) => console.error('Redis', error),
 * });
 *
 * await redis.client.set('greeting', 'hello', { EX: 60 });
 * await redis.close();
 */
export const connectRedis = async ({ onError, ...options }: IRedisOptions): Promise<IRedis> => {
  const reportError = onError ?? ((error: unknown): void => console.error(error));
  const client = createClient({
    ...options,
    socket: { connectTimeout: CONNECT_TIMEOUT_MS, ...options.socket },
    disableOfflineQueue: true,
  });
  client.on('error', reportError);
  await client.connect();
  const redis: IRedis = {
    client,
    close: async (): Promise<void> => {
      await client.close();
    },
  };
  ERROR_REPORTERS.set(redis, reportError);
  return redis;
};
