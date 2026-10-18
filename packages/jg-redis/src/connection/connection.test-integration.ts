import { afterEach, describe, expect, test, vi } from 'vitest';

import { connectTestRedis, createTestKey } from '../test-utils/redis.js';
import type { IRedis } from './types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Ends one client's connection from the server's side, as a restart or a network failure would,
 * leaving every other test's clients alone.
 * @param redis The client.
 * @returns A promise that resolves once the server dropped it.
 */
const killClient = async (redis: IRedis): Promise<void> => {
  const id = await redis.client.clientId();
  const admin = await connectTestRedis();
  try {
    await admin.client.sendCommand(['CLIENT', 'KILL', 'ID', String(id)]);
  } finally {
    await admin.close();
  }
};

describe('connectRedis', () => {
  test('rejects commands while disconnected instead of queueing them, and gives up connecting after 10 seconds', async () => {
    const redis = await connectTestRedis();
    try {
      expect(redis.client.options).toMatchObject({
        disableOfflineQueue: true,
        socket: { connectTimeout: 10_000 },
      });
    } finally {
      await redis.close();
    }
  });

  test('keeps the data when it closes', async () => {
    const key = createTestKey('kept');
    const first = await connectTestRedis();
    await first.client.set(key, 'value', { EX: 60 });
    await first.close();

    const second = await connectTestRedis();
    try {
      await expect(second.client.get(key)).resolves.toBe('value');
    } finally {
      await second.close();
    }
  });

  test('reports a dropped connection to onError instead of crashing', async () => {
    const onError = vi.fn();
    const redis = await connectTestRedis({ onError });
    try {
      await killClient(redis);
      await vi.waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });
    } finally {
      await redis.close().catch(() => undefined);
    }
  });

  test('reports to console.error without an onError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const redis = await connectTestRedis();
    try {
      await killClient(redis);
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });
    } finally {
      await redis.close().catch(() => undefined);
    }
  });
});
