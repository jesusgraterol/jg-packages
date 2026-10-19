import { expectToRejectCode, expectToThrowCode } from 'jg-exception/testing';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import type { IRedis } from '../connection/index.js';
import { ERRORS } from '../shared/index.js';
import { connectTestRedis, createTestKey } from '../test-utils/redis.js';
import { createBlocklist } from './blocklist.js';

let redis: IRedis;
let down: IRedis;

/**
 * Builds distinct values, such as IP addresses.
 * @param count How many.
 * @param prefix What each starts with.
 * @returns The values.
 */
const createValues = (count: number, prefix = '10.0'): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}.${String(index)}`);

beforeAll(async () => {
  redis = await connectTestRedis();
  down = await connectTestRedis({ onError: () => undefined });
  down.client.destroy();
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await redis.close();
});

describe('createBlocklist', () => {
  test('adds, checks, and removes values, ignoring repeats and values it lacks', async () => {
    const blocklist = createBlocklist(redis, { key: createTestKey('ip-blocklist') });

    await blocklist.add(['203.0.113.7', '2001:db8::1', '203.0.113.7']);

    await expect(blocklist.has('203.0.113.7')).resolves.toBe(true);
    await expect(blocklist.has('2001:db8::1')).resolves.toBe(true);
    await expect(blocklist.has('203.0.113.8')).resolves.toBe(false);

    await blocklist.remove(['203.0.113.7', '198.51.100.1']);

    await expect(blocklist.has('203.0.113.7')).resolves.toBe(false);
    await expect(blocklist.has('2001:db8::1')).resolves.toBe(true);
  });

  test('sends nothing for empty lists to add or remove', async () => {
    const key = createTestKey('ip-blocklist');
    const blocklist = createBlocklist(redis, { key });
    const sAdd = vi.spyOn(redis.client, 'sAdd');
    const sRem = vi.spyOn(redis.client, 'sRem');

    await blocklist.add([]);
    await blocklist.remove([]);

    expect(sAdd).not.toHaveBeenCalled();
    expect(sRem).not.toHaveBeenCalled();
    await expect(redis.client.exists(key)).resolves.toBe(0);
  });

  test('replaces every value at once, leaving no staging key and no expiry', async () => {
    const key = createTestKey('ip-blocklist');
    const blocklist = createBlocklist(redis, { key });
    await blocklist.add(['203.0.113.7', '203.0.113.8']);

    await blocklist.replaceAll(['198.51.100.1', '203.0.113.8']);

    expect((await redis.client.sMembers(key)).sort()).toStrictEqual([
      '198.51.100.1',
      '203.0.113.8',
    ]);
    await expect(redis.client.ttl(key)).resolves.toBe(-1);
    await expect(redis.client.keys(`${key}:replace:*`)).resolves.toStrictEqual([]);
  });

  test('deletes the list when it replaces every value with none', async () => {
    const key = createTestKey('ip-blocklist');
    const blocklist = createBlocklist(redis, { key });
    await blocklist.add(['203.0.113.7']);

    await blocklist.replaceAll([]);

    await expect(redis.client.exists(key)).resolves.toBe(0);
    await expect(blocklist.has('203.0.113.7')).resolves.toBe(false);
  });

  test('handles more than 1,000 values, 1,000 per command', async () => {
    const key = createTestKey('ip-blocklist');
    const blocklist = createBlocklist(redis, { key });
    const values = createValues(2_500);
    const sAdd = vi.spyOn(redis.client, 'sAdd');
    const sRem = vi.spyOn(redis.client, 'sRem');

    await blocklist.add(values);
    await blocklist.remove(values.slice(0, 1_001));

    expect(sAdd.mock.calls.map(([, chunk]) => (chunk as string[]).length)).toStrictEqual([
      1_000, 1_000, 500,
    ]);
    expect(sRem.mock.calls.map(([, chunk]) => (chunk as string[]).length)).toStrictEqual([
      1_000, 1,
    ]);
    await expect(redis.client.sCard(key)).resolves.toBe(1_499);
    await expect(blocklist.has('10.0.2499')).resolves.toBe(true);

    await blocklist.replaceAll(createValues(2_001, '10.1'));

    await expect(redis.client.sCard(key)).resolves.toBe(2_001);
    await expect(blocklist.has('10.0.2499')).resolves.toBe(false);
    await expect(blocklist.has('10.1.2000')).resolves.toBe(true);
    await expect(redis.client.ttl(key)).resolves.toBe(-1);
  });

  test('fails closed with BLOCKLIST_FAILED, and the cause, when Redis is unreachable', async () => {
    const blocklist = createBlocklist(down, { key: createTestKey('ip-blocklist') });

    for (const pending of [
      blocklist.has('203.0.113.7'),
      blocklist.add(['203.0.113.7']),
      blocklist.remove(['203.0.113.7']),
      blocklist.replaceAll(['203.0.113.7']),
      blocklist.replaceAll([]),
    ]) {
      const error: unknown = await pending.catch((caught: unknown) => caught);
      expect(error).toMatchObject({
        code: ERRORS.BLOCKLIST_FAILED,
        message: 'Redis could not complete the blocklist command.',
      });
      expect((error as Error).cause).toBeInstanceOf(Error);
    }
  });

  test.each<[string, unknown]>([
    ['an empty value', ''],
    ['a value of 513 characters', 'a'.repeat(513)],
    ['a value that is not a string', 42],
  ])('rejects %s with BLOCKLIST_VALUE_INVALID, sending nothing', async (_, value) => {
    const key = createTestKey('ip-blocklist');
    const blocklist = createBlocklist(redis, { key });
    await blocklist.add(['203.0.113.7']);

    await expectToRejectCode(
      blocklist.has(value as string),
      ERRORS.BLOCKLIST_VALUE_INVALID,
      'Each blocklist value must be a string of 1 to 512 characters.',
    );
    for (const pending of [
      blocklist.add(['198.51.100.1', value as string]),
      blocklist.remove(['203.0.113.7', value as string]),
      blocklist.replaceAll(['198.51.100.1', value as string]),
    ]) {
      await expectToRejectCode(pending, ERRORS.BLOCKLIST_VALUE_INVALID);
    }

    await expect(redis.client.sMembers(key)).resolves.toStrictEqual(['203.0.113.7']);
  });

  test('rejects a list that is not an array, and accepts a value of 512 characters', async () => {
    const blocklist = createBlocklist(redis, { key: createTestKey('ip-blocklist') });

    await expectToRejectCode(
      blocklist.add('203.0.113.7' as unknown as string[]),
      ERRORS.BLOCKLIST_VALUE_INVALID,
    );
    await blocklist.add(['a'.repeat(512)]);
    await expect(blocklist.has('a'.repeat(512))).resolves.toBe(true);
  });

  test.each<[string, unknown]>([
    ['an empty key', ''],
    ['a key that is not a string', undefined],
  ])('throws INVALID_BLOCKLIST_KEY for %s', (_, key) => {
    expectToThrowCode(
      () => createBlocklist(redis, { key: key as string }),
      ERRORS.INVALID_BLOCKLIST_KEY,
      'The blocklist key must be a non-empty string.',
    );
  });
});
