import { getErrorReporter } from '../connection/connection.js';
import type { IRedis } from '../connection/index.js';
import { assertTtl } from '../shared/utilities.js';
import type { ICache, IGetOrLoadOptions } from './types.js';

// the largest entry the cache stores, so one large value can't fill the server
const MAX_ENTRY_BYTES = 1024 * 1024;

// a cached value, wrapped so a cached null differs from a miss
type ICacheEntry = { value: unknown };

// a load in flight: the promise its callers share, and whether invalidate made its value stale
type IInFlightLoad = { promise: Promise<unknown>; state: { isStale: boolean } };

/**
 * Reads a cached entry and checks its value.
 * @param text The entry, as Redis returned it.
 * @param schema The value's schema.
 * @returns The value, or undefined when the entry or its value is invalid.
 */
const readEntry = <T>(
  text: string,
  schema: IGetOrLoadOptions<T>['schema'],
): { value: T } | undefined => {
  try {
    const entry = JSON.parse(text) as unknown;
    if (typeof entry !== 'object' || entry === null || !('value' in entry)) {
      return undefined;
    }
    return { value: schema.parse(entry.value) };
  } catch {
    return undefined;
  }
};

/**
 * Creates a read-through cache on a Redis client, for values that are slow to load and fine to
 * serve a little stale. A failed read loads the value instead, and a failed or oversized write
 * is skipped, so Redis being down slows the app without breaking it; both failures go to the
 * client's onError. Concurrent misses for one key in this process share one load.
 * @param redis The client, from connectRedis.
 * @returns The cache.
 * @example
 * import { connectRedis, createCache } from 'jg-redis';
 * import { z } from 'zod';
 *
 * declare const redis: Awaited<ReturnType<typeof connectRedis>>;
 * declare const loadProfile: (id: string) => Promise<{ name: string }>;
 *
 * const cache = createCache(redis);
 * const profile = await cache.getOrLoad('user:42:profile', {
 *   schema: z.object({ name: z.string() }),
 *   ttlSeconds: 300,
 *   load: () => loadProfile('42'),
 * });
 */
export const createCache = (redis: IRedis): ICache => {
  const reportError = getErrorReporter(redis);
  // the load in flight for each key, which concurrent misses share; only keys being loaded are
  // held, so the map never outgrows the loads running at once
  const loads = new Map<string, IInFlightLoad>();

  /**
   * Stores a loaded value, unless the key was invalidated since the load started, or the value
   * is too large or can't be written as JSON.
   * @param key The key.
   * @param value The value.
   * @param ttlSeconds How long it stays cached.
   * @param state Whether invalidate made the load stale.
   * @returns A promise that resolves once the write is done or skipped.
   */
  const store = async (
    key: string,
    value: unknown,
    ttlSeconds: number,
    state: IInFlightLoad['state'],
  ): Promise<void> => {
    if (state.isStale) {
      return;
    }
    let text: string;
    try {
      text = JSON.stringify({ value } satisfies ICacheEntry);
    } catch (error) {
      reportError(error);
      return;
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_ENTRY_BYTES) {
      return;
    }
    try {
      await redis.client.set(key, text, { EX: ttlSeconds });
    } catch (error) {
      reportError(error);
    }
  };

  /**
   * Reads a key, or loads and stores its value.
   * @param key The key.
   * @param options The schema, the time-to-live, and the loader.
   * @param state Whether invalidate made the load stale.
   * @returns A promise that resolves to the value.
   */
  const readOrLoad = async <T>(
    key: string,
    { schema, ttlSeconds, load }: IGetOrLoadOptions<T>,
    state: IInFlightLoad['state'],
  ): Promise<T> => {
    let text: string | null;
    try {
      text = await redis.client.get(key);
    } catch (error) {
      reportError(error);
      return load();
    }
    if (text !== null) {
      const entry = readEntry(text, schema);
      if (entry !== undefined) {
        return entry.value;
      }
      // an entry from an older shape of the value, or a corrupted one, is replaced
      await redis.client.unlink(key).catch(reportError);
    }
    const value = await load();
    await store(key, value, ttlSeconds, state);
    return value;
  };

  return {
    getOrLoad: async <T>(key: string, options: IGetOrLoadOptions<T>): Promise<T> => {
      assertTtl(options.ttlSeconds);
      const inFlight = loads.get(key);
      if (inFlight !== undefined) {
        return inFlight.promise as Promise<T>;
      }
      const state = { isStale: false };
      const promise = readOrLoad(key, options, state).finally(() => {
        if (loads.get(key)?.state === state) {
          loads.delete(key);
        }
      });
      loads.set(key, { promise, state });
      return promise;
    },
    invalidate: async (key: string): Promise<void> => {
      // the load in flight stores nothing, and the next read starts a fresh one
      const inFlight = loads.get(key);
      if (inFlight !== undefined) {
        inFlight.state.isStale = true;
        loads.delete(key);
      }
      await redis.client.unlink(key);
    },
  };
};
