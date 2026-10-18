import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { z } from 'zod';

import type { IRedis } from '../connection/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestRedis, createTestKey } from '../test-utils/redis.js';
import { createCache } from './cache.js';
import type { ICache } from './types.js';

let redis: IRedis;
let cache: ICache;
const onError = vi.fn();

// a cached profile's shape
const ProfileSchema = z.object({ name: z.string() });

beforeAll(async () => {
  redis = await connectTestRedis({ onError });
  cache = createCache(redis);
});

afterEach(() => {
  onError.mockClear();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await redis.close();
});

describe('getOrLoad', () => {
  test('loads and caches a miss with its TTL, then serves the cached value', async () => {
    const key = createTestKey('profile');
    const load = vi.fn(() => Promise.resolve({ name: 'Ada' }));

    await expect(
      cache.getOrLoad(key, { schema: ProfileSchema, ttlSeconds: 60, load }),
    ).resolves.toStrictEqual({ name: 'Ada' });
    await expect(
      cache.getOrLoad(key, { schema: ProfileSchema, ttlSeconds: 60, load }),
    ).resolves.toStrictEqual({ name: 'Ada' });

    expect(load).toHaveBeenCalledOnce();
    const ttl = await redis.client.ttl(key);
    expect(ttl > 0 && ttl <= 60).toBe(true);
  });

  test("propagates the loader's error, and caches nothing", async () => {
    const key = createTestKey('profile');
    const loadError = new Error('the database is down');

    await expect(
      cache.getOrLoad(key, {
        schema: ProfileSchema,
        ttlSeconds: 60,
        load: () => Promise.reject(loadError),
      }),
    ).rejects.toBe(loadError);
    await expect(redis.client.exists(key)).resolves.toBe(0);
  });

  test('shares one load among concurrent misses for a key', async () => {
    const key = createTestKey('profile');
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { name: 'Ada' };
    });

    const values = await Promise.all(
      Array.from({ length: 10 }, () =>
        cache.getOrLoad(key, { schema: ProfileSchema, ttlSeconds: 60, load }),
      ),
    );

    expect(load).toHaveBeenCalledOnce();
    expect(values).toStrictEqual(Array.from({ length: 10 }, () => ({ name: 'Ada' })));
  });

  test('caches a null, so it is never mistaken for a miss', async () => {
    const key = createTestKey('profile');
    const load = vi.fn(() => Promise.resolve(null));
    const options = { schema: ProfileSchema.nullable(), ttlSeconds: 60, load };

    await expect(cache.getOrLoad(key, options)).resolves.toBeNull();
    await expect(cache.getOrLoad(key, options)).resolves.toBeNull();

    expect(load).toHaveBeenCalledOnce();
  });

  test.each([
    ['a value its schema rejects', JSON.stringify({ value: { name: 42 } })],
    ['text that is not JSON', 'not json'],
    ['JSON that is not an entry', JSON.stringify({ name: 'Ada' })],
  ])('deletes %s and loads again', async (_, stored) => {
    const key = createTestKey('profile');
    await redis.client.set(key, stored);
    const load = vi.fn(() => Promise.resolve({ name: 'Ada' }));

    await expect(
      cache.getOrLoad(key, { schema: ProfileSchema, ttlSeconds: 60, load }),
    ).resolves.toStrictEqual({ name: 'Ada' });
    expect(load).toHaveBeenCalledOnce();
    await expect(redis.client.get(key)).resolves.toBe(JSON.stringify({ value: { name: 'Ada' } }));
  });

  test('returns a value over 1 MiB without caching it', async () => {
    const key = createTestKey('report');
    const large = 'x'.repeat(1024 * 1024);

    await expect(
      cache.getOrLoad(key, {
        schema: z.string(),
        ttlSeconds: 60,
        load: () => Promise.resolve(large),
      }),
    ).resolves.toBe(large);
    await expect(redis.client.exists(key)).resolves.toBe(0);
  });

  test('returns a value JSON cannot hold without caching it, and reports why', async () => {
    const key = createTestKey('total');

    await expect(
      cache.getOrLoad(key, {
        schema: z.bigint(),
        ttlSeconds: 60,
        load: () => Promise.resolve(10n),
      }),
    ).resolves.toBe(10n);
    await expect(redis.client.exists(key)).resolves.toBe(0);
    expect(onError).toHaveBeenCalledOnce();
  });

  test.each([0, -1, 1.5, Number.NaN])('rejects a TTL of %d seconds', async (ttlSeconds) => {
    await expectToRejectCode(
      cache.getOrLoad(createTestKey('profile'), {
        schema: ProfileSchema,
        ttlSeconds,
        load: () => Promise.resolve({ name: 'Ada' }),
      }),
      ERRORS.INVALID_TTL,
      'The time-to-live must be a whole number of seconds, from 1.',
    );
  });

  test('skips a failed write, reports it, and still returns the value', async () => {
    const key = createTestKey('profile');
    const writeError = new Error('OOM command not allowed when used memory > maxmemory');
    vi.spyOn(redis.client, 'set').mockRejectedValueOnce(writeError);

    await expect(
      cache.getOrLoad(key, {
        schema: ProfileSchema,
        ttlSeconds: 60,
        load: () => Promise.resolve({ name: 'Ada' }),
      }),
    ).resolves.toStrictEqual({ name: 'Ada' });
    expect(onError).toHaveBeenCalledExactlyOnceWith(writeError);
  });

  test('reports to console.error for a client connectRedis did not create', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const writeError = new Error('READONLY You cannot write against a read only replica.');
    vi.spyOn(redis.client, 'set').mockRejectedValueOnce(writeError);

    await createCache({ ...redis }).getOrLoad(createTestKey('profile'), {
      schema: ProfileSchema,
      ttlSeconds: 60,
      load: () => Promise.resolve({ name: 'Ada' }),
    });

    expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(writeError);
    expect(onError).not.toHaveBeenCalled();
  });

  test('loads straight from the loader when Redis is unreachable, and reports it', async () => {
    const reported = vi.fn();
    const down = await connectTestRedis({ onError: reported });
    down.client.destroy();
    const load = vi.fn(() => Promise.resolve({ name: 'Ada' }));

    await expect(
      createCache(down).getOrLoad(createTestKey('profile'), {
        schema: ProfileSchema,
        ttlSeconds: 60,
        load,
      }),
    ).resolves.toStrictEqual({ name: 'Ada' });
    expect(load).toHaveBeenCalledOnce();
    expect(reported).toHaveBeenCalled();
  });
});

describe('invalidate', () => {
  test('deletes the cached value, so the next read loads again', async () => {
    const key = createTestKey('profile');
    const load = vi
      .fn()
      .mockResolvedValueOnce({ name: 'Ada' })
      .mockResolvedValueOnce({ name: 'Grace' });
    const options = { schema: ProfileSchema, ttlSeconds: 60, load };

    await cache.getOrLoad(key, options);
    await cache.invalidate(key);

    await expect(cache.getOrLoad(key, options)).resolves.toStrictEqual({ name: 'Grace' });
  });

  test('keeps a load already in flight from storing its older value', async () => {
    const key = createTestKey('profile');
    let finishLoad: (value: { name: string }) => void = () => undefined;
    const slowLoad = new Promise<{ name: string }>((resolve) => {
      finishLoad = resolve;
    });
    const stale = cache.getOrLoad(key, {
      schema: ProfileSchema,
      ttlSeconds: 60,
      load: () => slowLoad,
    });
    await vi.waitFor(async () => {
      await expect(redis.client.exists(key)).resolves.toBe(0);
    });

    await cache.invalidate(key);
    const fresh = cache.getOrLoad(key, {
      schema: ProfileSchema,
      ttlSeconds: 60,
      load: () => Promise.resolve({ name: 'Grace' }),
    });
    finishLoad({ name: 'Ada' });

    await expect(stale).resolves.toStrictEqual({ name: 'Ada' });
    await expect(fresh).resolves.toStrictEqual({ name: 'Grace' });
    await expect(redis.client.get(key)).resolves.toBe(JSON.stringify({ value: { name: 'Grace' } }));
  });

  test('accepts a key that holds nothing', async () => {
    await expect(cache.invalidate(createTestKey('missing'))).resolves.toBeUndefined();
  });
});
