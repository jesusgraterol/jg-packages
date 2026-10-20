// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/errors.js';
import { expectToThrowCode } from 'jg-exception/testing';

import { createByteCache } from './byte-cache.js';

const bytesOf = (...values: number[]): Uint8Array => new Uint8Array(values);

describe('createByteCache', () => {
  test('returns copies, so changing them changes nothing cached', () => {
    const cache = createByteCache({ maxBytes: 8 });
    const original = bytesOf(1, 2);

    expect(cache.set('a', original)).toBe(true);
    original[0] = 9;
    const read = cache.get('a');
    if (read !== undefined) {
      read[1] = 9;
    }

    expect(cache.get('a')).toStrictEqual(bytesOf(1, 2));
    expect(cache.get('missing')).toBeUndefined();
  });

  test('evicts the least recently used entries until the bytes fit', () => {
    const cache = createByteCache({ maxBytes: 5 });
    cache.set('a', bytesOf(1, 1));
    cache.set('b', bytesOf(2, 2));
    cache.get('a');

    expect(cache.set('c', bytesOf(3, 3, 3))).toBe(true);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toStrictEqual(bytesOf(1, 1));
    expect(cache.byteLength).toBe(5);
  });

  test('evicts the least recently used entries until the entries fit', () => {
    const cache = createByteCache({ maxBytes: 100, maxEntries: 2 });
    cache.set('a', bytesOf(1));
    cache.set('b', bytesOf(2));

    cache.set('c', bytesOf(3));

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toStrictEqual(bytesOf(2));
    expect(cache.get('c')).toStrictEqual(bytesOf(3));
  });

  test('replaces an entry, counting only its new bytes', () => {
    const cache = createByteCache({ maxBytes: 4, maxEntries: 1 });
    cache.set('a', bytesOf(1, 1, 1));

    expect(cache.set('a', bytesOf(2, 2, 2, 2))).toBe(true);
    expect(cache.get('a')).toStrictEqual(bytesOf(2, 2, 2, 2));
    expect(cache.byteLength).toBe(4);
  });

  test('skips bytes larger than the whole cache, keeping what it holds', () => {
    const cache = createByteCache({ maxBytes: 3 });
    cache.set('a', bytesOf(1));

    expect(cache.set('big', bytesOf(1, 2, 3, 4))).toBe(false);
    expect(cache.get('a')).toStrictEqual(bytesOf(1));
    expect(cache.byteLength).toBe(1);
  });

  test('never evicts or replaces a retained entry until it is released', () => {
    const cache = createByteCache({ maxBytes: 4 });
    cache.set('pinned', bytesOf(1, 1));
    const retention = cache.retain('pinned');

    expect(cache.set('pinned', bytesOf(5))).toBe(false);
    expect(cache.set('other', bytesOf(2, 2))).toBe(true);
    expect(cache.set('third', bytesOf(3, 3))).toBe(true);
    expect(cache.get('other')).toBeUndefined();
    expect(cache.set('too-big', bytesOf(4, 4, 4))).toBe(false);
    expect(retention?.copyBytes()).toStrictEqual(bytesOf(1, 1));

    retention?.release();
    retention?.release();

    expect(retention?.copyBytes()).toBeUndefined();
    expect(cache.set('too-big', bytesOf(4, 4, 4))).toBe(true);
    expect(cache.get('pinned')).toBeUndefined();
  });

  test('keeps an entry retained twice until both release it', () => {
    const cache = createByteCache({ maxBytes: 2, maxEntries: 1 });
    cache.set('a', bytesOf(1));
    const first = cache.retain('a');
    const second = cache.retain('a');

    first?.release();
    expect(cache.set('b', bytesOf(2))).toBe(false);
    second?.release();

    expect(cache.set('b', bytesOf(2))).toBe(true);
    expect(cache.retain('a')).toBeUndefined();
  });

  test.each([
    [{ maxBytes: -1 }],
    [{ maxBytes: 1.5 }],
    [{ maxBytes: 10, maxEntries: 0 }],
    [{ maxBytes: 10, maxEntries: 2.5 }],
  ])('createByteCache(%o) -> throws INVALID_BYTE_LIMIT', (options) => {
    expectToThrowCode(() => createByteCache(options), ERRORS.INVALID_BYTE_LIMIT);
  });
});
