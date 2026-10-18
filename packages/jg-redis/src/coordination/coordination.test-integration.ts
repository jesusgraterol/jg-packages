import { createHash } from 'node:crypto';

import { expectToRejectCode } from 'jg-exception/testing';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { z } from 'zod';

import type { IRedis } from '../connection/index.js';
import { ERRORS } from '../shared/index.js';
import { expectNoValue } from '../test-utils/leak.js';
import { connectTestRedis, createTestKey } from '../test-utils/redis.js';
import { claimOnce, storeSingleUseValue, takeSingleUseValue } from './coordination.js';

let redis: IRedis;
let down: IRedis;

// a sign-in challenge's record
const ChallengeSchema = z.object({ userId: z.string() });

beforeAll(async () => {
  redis = await connectTestRedis();
  down = await connectTestRedis({ onError: () => undefined });
  down.client.destroy();
});

afterAll(async () => {
  await redis.close();
});

describe('claimOnce', () => {
  test('lets the first claim of a token through, and no other until it expires', async () => {
    const namespace = createTestKey('used-otp');

    await expect(claimOnce(redis, namespace, '123456', 90)).resolves.toBe(true);
    await expect(claimOnce(redis, namespace, '123456', 90)).resolves.toBe(false);
    await expect(claimOnce(redis, namespace, '654321', 90)).resolves.toBe(true);
  });

  test('lets exactly one of many concurrent claims through', async () => {
    const namespace = createTestKey('used-otp');

    const claims = await Promise.all(
      Array.from({ length: 10 }, () => claimOnce(redis, namespace, '123456', 90)),
    );

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  test("stores only the token's hash, with the TTL", async () => {
    const namespace = createTestKey('used-otp');
    const key = `${namespace}:${createHash('sha256').update('123456').digest('hex')}`;

    await claimOnce(redis, namespace, '123456', 90);

    const ttl = await redis.client.ttl(key);
    expect(ttl > 0 && ttl <= 90).toBe(true);
    await expect(redis.client.keys(`${namespace}:*`)).resolves.toStrictEqual([key]);
  });

  test('fails closed when Redis is unreachable', async () => {
    await expectToRejectCode(
      claimOnce(down, createTestKey('used-otp'), '123456', 90),
      ERRORS.COORDINATION_FAILED,
      'Redis could not complete the coordination command.',
    );
  });

  test('rejects a TTL that is not a whole number of seconds', async () => {
    await expectToRejectCode(claimOnce(redis, 'used-otp', '123456', 0.5), ERRORS.INVALID_TTL);
  });
});

describe('single-use values', () => {
  test('gives a stored value to the first taker, and null afterwards', async () => {
    const key = createTestKey('challenge');

    await storeSingleUseValue(redis, key, { userId: '42' }, 300);

    await expect(takeSingleUseValue(redis, key, ChallengeSchema)).resolves.toStrictEqual({
      userId: '42',
    });
    await expect(takeSingleUseValue(redis, key, ChallengeSchema)).resolves.toBeNull();
    await expect(
      takeSingleUseValue(redis, createTestKey('missing'), ChallengeSchema),
    ).resolves.toBeNull();
  });

  test('gives the value to exactly one of many concurrent takers', async () => {
    const key = createTestKey('challenge');
    await storeSingleUseValue(redis, key, { userId: '42' }, 300);

    const taken = await Promise.all(
      Array.from({ length: 10 }, () => takeSingleUseValue(redis, key, ChallengeSchema)),
    );

    expect(taken.filter((value) => value !== null)).toStrictEqual([{ userId: '42' }]);
  });

  test("rejects a value that fails its schema without the value, and it's gone", async () => {
    const key = createTestKey('challenge');
    await storeSingleUseValue(redis, key, { userId: 42, secret: 'Zq9-session-token' }, 300);
    const broken = createTestKey('challenge');
    await redis.client.set(broken, '{"secret": Zq9-session-token}');

    for (const target of [key, broken]) {
      const error = await takeSingleUseValue(redis, target, ChallengeSchema).catch(
        (cause: unknown) => cause,
      );

      expect(error).toMatchObject({
        code: ERRORS.COORDINATION_VALUE_INVALID,
        message: 'The single-use value is not valid JSON or does not match its schema.',
      });
      expect((error as Error).cause).toBeUndefined();
      expectNoValue(error, 'Zq9');
      await expect(redis.client.exists(target)).resolves.toBe(0);
    }
  });

  test('fails closed when Redis is unreachable', async () => {
    await expectToRejectCode(
      storeSingleUseValue(down, createTestKey('challenge'), { userId: '42' }, 300),
      ERRORS.COORDINATION_FAILED,
    );
    await expectToRejectCode(
      takeSingleUseValue(down, createTestKey('challenge'), ChallengeSchema),
      ERRORS.COORDINATION_FAILED,
    );
  });

  test('rejects a TTL that is not a whole number of seconds', async () => {
    await expectToRejectCode(
      storeSingleUseValue(redis, createTestKey('challenge'), {}, -5),
      ERRORS.INVALID_TTL,
    );
  });
});
