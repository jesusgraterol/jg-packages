import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/errors.js';
import { validateByteLimit } from '../transformers/index.js';

import type { IByteCache, IByteCacheOptions, IByteCacheRetention } from './types.js';

// one cached value, and how many retentions pin it
type IByteCacheEntry = { bytes: Uint8Array; retentions: number };

/**
 * Creates a least-recently-used cache of bytes, such as file pages or API responses, that never
 * holds more than `maxBytes` and, when given, `maxEntries`. It copies bytes on the way in and out,
 * so no caller can change a cached value. `retain` pins an entry, such as while a reader streams
 * it, so it's never evicted or replaced until released, and pinned bytes count toward the limit.
 * @param options The byte limit, and the optional entry limit.
 * @returns The cache.
 * @example
 * import { createByteCache } from 'jg-utilities';
 *
 * const cache = createByteCache({ maxBytes: 4 });
 * cache.set('a', new Uint8Array([1, 2])); // => true
 * cache.set('b', new Uint8Array([3, 4])); // => true
 * cache.get('a'); // => new Uint8Array([1, 2])
 * cache.set('c', new Uint8Array([5])); // => true
 * cache.get('b'); // => undefined
 * cache.byteLength; // => 3
 * @throws
 * - INVALID_BYTE_LIMIT: The byte limit must be a non-negative safe integer, and the entry limit a
 * positive one.
 */
export const createByteCache = ({ maxBytes, maxEntries }: IByteCacheOptions): IByteCache => {
  validateByteLimit(maxBytes);
  if (maxEntries !== undefined && (!Number.isSafeInteger(maxEntries) || maxEntries < 1)) {
    throw new Exception('The entry limit must be a positive safe integer.', {
      code: ERRORS.INVALID_BYTE_LIMIT,
      data: { maxEntries: String(maxEntries) },
    });
  }
  const entryLimit = maxEntries ?? Number.POSITIVE_INFINITY;
  // a Map iterates in insertion order, so its first entry is the least recently used
  const entries = new Map<string, IByteCacheEntry>();
  let byteLength = 0;
  let retainedBytes = 0;
  let retainedEntries = 0;

  const evict = (key: string, entry: IByteCacheEntry): void => {
    entries.delete(key);
    byteLength -= entry.bytes.byteLength;
  };

  return {
    get: (key) => {
      const entry = entries.get(key);
      if (entry === undefined) {
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.bytes.slice();
    },
    set: (key, bytes) => {
      const existing = entries.get(key);
      if (existing !== undefined && existing.retentions > 0) {
        return false;
      }
      // the room left once every entry that isn't retained is evicted
      if (retainedBytes + bytes.byteLength > maxBytes || retainedEntries + 1 > entryLimit) {
        return false;
      }
      if (existing !== undefined) {
        evict(key, existing);
      }
      for (const [oldestKey, oldest] of entries) {
        if (byteLength + bytes.byteLength <= maxBytes && entries.size < entryLimit) {
          break;
        }
        if (oldest.retentions === 0) {
          evict(oldestKey, oldest);
        }
      }
      entries.set(key, { bytes: bytes.slice(), retentions: 0 });
      byteLength += bytes.byteLength;
      return true;
    },
    retain: (key) => {
      let entry = entries.get(key);
      if (entry === undefined) {
        return undefined;
      }
      if (entry.retentions === 0) {
        retainedBytes += entry.bytes.byteLength;
        retainedEntries += 1;
      }
      entry.retentions += 1;
      const retention: IByteCacheRetention = {
        copyBytes: () => entry?.bytes.slice(),
        release: () => {
          if (entry === undefined) {
            return;
          }
          entry.retentions -= 1;
          if (entry.retentions === 0) {
            retainedBytes -= entry.bytes.byteLength;
            retainedEntries -= 1;
          }
          entry = undefined;
        },
      };
      return retention;
    },
    get byteLength() {
      return byteLength;
    },
  };
};
