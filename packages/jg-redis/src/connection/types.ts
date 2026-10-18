import type { createClient, RedisClientOptions } from 'redis';

// a node-redis client, as createClient returns it
export type IRedisClient = ReturnType<typeof createClient>;

// what connectRedis takes: node-redis's client options, such as the URL or the socket's host and
// port, plus where the client's errors go
export type IRedisOptions = Omit<RedisClientOptions, 'disableOfflineQueue'> & {
  // receives the client's errors, such as a dropped connection, and the cache's failed reads and
  // writes. Defaults to console.error
  onError?: ((error: unknown) => void) | undefined;
};

// a connected Redis client
export type IRedis = {
  // the node-redis client, for the commands the helpers don't cover
  readonly client: IRedisClient;

  // closes the client once its pending replies arrive. It never flushes any data
  close: () => Promise<void>;
};
