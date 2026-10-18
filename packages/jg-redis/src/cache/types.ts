import type { ISchema } from '../shared/index.js';

// what getOrLoad reads and, on a miss, loads and stores
export type IGetOrLoadOptions<T> = {
  // checks a cached value before it's returned, such as a Zod schema. A value it rejects is
  // deleted and loaded again
  schema: ISchema<T>;

  // how long a loaded value stays cached, in whole seconds, from 1
  ttlSeconds: number;

  // loads the value on a miss, such as with a database query. Its error propagates, and nothing
  // is cached
  load: () => Promise<T>;
};

// a read-through cache on a Redis client
export type ICache = {
  // returns the cached value, or loads, caches, and returns it on a miss, sharing one load among
  // the process's concurrent misses for the key. When Redis fails, it loads without caching
  getOrLoad: <T>(key: string, options: IGetOrLoadOptions<T>) => Promise<T>;

  // deletes a cached value, so the next read loads it again. A load already in flight in this
  // process won't store its older value afterwards
  invalidate: (key: string) => Promise<void>;
};
