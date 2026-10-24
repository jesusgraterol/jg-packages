import { Exception } from 'jg-exception';
import { createClient } from 'redis';

import { ERRORS } from '../shared/errors.js';

import type { IRedis, IRedisClient, IRedisOptions } from './types.js';

// how long connecting may take before it fails, unless the options say otherwise
const CONNECT_TIMEOUT_MS = 10_000;

// the longest delay a Node.js timer accepts; a longer one fires after 1 millisecond
const MAX_CONNECT_TIMEOUT_MS = 2_147_483_647;

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
 * Reads how long the first connection may take.
 * @param connectTimeout The socket options' connectTimeout, in milliseconds.
 * @returns It, or 10 seconds when it's unset.
 * @throws
 * - INVALID_CONNECT_TIMEOUT: The connect timeout must be a whole number of milliseconds, from 1 to 2,147,483,647.
 */
const readConnectTimeout = (connectTimeout: number | undefined): number => {
  const timeoutMs = connectTimeout ?? CONNECT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_CONNECT_TIMEOUT_MS) {
    throw new Exception(
      'The connect timeout must be a whole number of milliseconds, from 1 to 2,147,483,647.',
      { code: ERRORS.INVALID_CONNECT_TIMEOUT },
    );
  }
  return timeoutMs;
};

/**
 * Builds the exception for a first connection that didn't happen.
 * @param cause The latest attempt's error, or why node-redis stopped retrying.
 * @returns The CONNECTION_FAILED exception.
 */
const connectionFailed = (cause: unknown): Exception =>
  new Exception('Could not connect to Redis.', { code: ERRORS.CONNECTION_FAILED, cause });

/**
 * Waits for a client's first connection, and gives up once timeoutMs pass. node-redis bounds only
 * each attempt with connectTimeout and retries failed ones forever, and its destroy closes only a
 * socket that has connected, so an attempt still connecting at the deadline is destroyed once the
 * client reports that it connected or failed.
 * @param client The client, not connected yet.
 * @param timeoutMs How long the first connection may take.
 * @returns A promise that resolves once the client is connected.
 * @throws
 * - CONNECTION_FAILED: Could not connect to Redis.
 */
const connectFirst = (client: IRedisClient, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    // whether an attempt is still connecting, which destroy can't close yet
    let isAttemptPending = true;
    let latestError: unknown;
    let hasExpired = false;
    const removeListeners = (): void => {
      client.off('connect', onConnect).off('error', onError).off('reconnecting', onReconnecting);
    };
    const stop = (): void => {
      // a reconnect strategy that gives up closes the client before it reports the error
      if (client.isOpen) client.destroy();
      removeListeners();
    };
    const onConnect = (): void => {
      isAttemptPending = false;
      if (hasExpired) stop();
    };
    const onError = (error: unknown): void => {
      isAttemptPending = false;
      latestError = error;
      if (hasExpired) stop();
    };
    const onReconnecting = (): void => {
      isAttemptPending = true;
    };
    client.on('connect', onConnect).on('error', onError).on('reconnecting', onReconnecting);
    const timer = setTimeout(() => {
      hasExpired = true;
      reject(connectionFailed(latestError));
      if (!isAttemptPending) stop();
    }, timeoutMs);
    // connect can settle after the deadline, or never once a connecting attempt was destroyed
    void client.connect().then(
      () => {
        if (hasExpired) return;
        clearTimeout(timer);
        removeListeners();
        resolve();
      },
      (error: unknown) => {
        if (hasExpired) return;
        clearTimeout(timer);
        removeListeners();
        reject(connectionFailed(error));
      },
    );
  });

/**
 * Connects a Redis client that's safe to share: its errors go to onError instead of crashing the
 * process, and a command sent while disconnected is rejected instead of queued and replayed later.
 * It rejects with CONNECTION_FAILED once `socket.connectTimeout`, 10 seconds by default, passes
 * without a first connection, or sooner when its reconnect strategy gives up; it then closes every
 * attempt, including one still connecting. Closing it waits for pending replies and never flushes
 * any data.
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
 * @throws
 * - INVALID_CONNECT_TIMEOUT: The connect timeout must be a whole number of milliseconds, from 1 to 2,147,483,647.
 * - CONNECTION_FAILED: Could not connect to Redis.
 */
export const connectRedis = async ({ onError, ...options }: IRedisOptions): Promise<IRedis> => {
  const reportError = onError ?? ((error: unknown): void => console.error(error));
  const connectTimeout = readConnectTimeout(options.socket?.connectTimeout);
  const client = createClient({
    ...options,
    socket: { ...options.socket, connectTimeout },
    disableOfflineQueue: true,
  });
  client.on('error', reportError);
  await connectFirst(client, connectTimeout);
  const redis: IRedis = {
    client,
    close: async (): Promise<void> => {
      await client.close();
    },
  };
  ERROR_REPORTERS.set(redis, reportError);
  return redis;
};
