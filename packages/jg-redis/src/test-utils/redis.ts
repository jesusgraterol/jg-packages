import { randomUUID } from 'node:crypto';

import { inject } from 'vitest';

import { connectRedis } from '../connection/index.js';
import type { IRedis, IRedisOptions } from '../connection/index.js';

/**
 * Connects to the test container's Redis.
 * @param options More client options, such as onError.
 * @returns A promise that resolves to the client.
 */
export const connectTestRedis = (options: Partial<IRedisOptions> = {}): Promise<IRedis> =>
  connectRedis({ url: inject('redisUrl'), ...options });

/**
 * Creates a key no other test uses, so test files can run at the same time.
 * @param facet What the key holds, such as `profile`.
 * @returns The key, such as `test:1a2b3c4d:profile`.
 */
export const createTestKey = (facet: string): string => `test:${randomUUID().slice(0, 8)}:${facet}`;
