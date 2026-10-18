# jg-redis

Redis for Node.js on node-redis: a read-through cache that survives Redis failing, and fail-closed one-time claims.

## Install

```bash
npm install jg-redis
```

## Usage

Connect one client per Redis server, and close it at shutdown:

```ts
import { connectRedis } from 'jg-redis';

const redis = await connectRedis({
  socket: { host: 'cache.internal', port: 6379 },
  password: 'secret',
  onError: (error) => console.error('Redis', error),
});

await redis.close(); // waits for pending replies, and never flushes any data
```

The client sends its errors, such as a dropped connection, to `onError`, `console.error` by default, instead of crashing the process. A command sent while it's disconnected is rejected instead of queued and replayed later, and connecting gives up after 10 seconds unless `socket.connectTimeout` says otherwise. `redis.client` is the node-redis client, for every other command.

### A read-through cache

```ts
import { connectRedis, createCache } from 'jg-redis';
import { z } from 'zod';

declare const redis: Awaited<ReturnType<typeof connectRedis>>;
declare const loadProfile: (id: string) => Promise<{ name: string } | null>;

const cache = createCache(redis);

const profile = await cache.getOrLoad('user:42:profile', {
  schema: z.object({ name: z.string() }).nullable(),
  ttlSeconds: 300,
  load: () => loadProfile('42'),
});

await cache.invalidate('user:42:profile'); // after the profile changes
```

- Concurrent misses for a key in the process share one load.
- A cached `null` is a hit, not a miss.
- A cached value its schema rejects, such as one from an older shape, is deleted and loaded again.
- Every value is stored with its TTL in the same command, and a value over 1 MiB isn't stored.
- When Redis fails to read, the value is loaded instead; when a write fails, it's skipped. Both go to `onError`, so Redis being down slows the app without breaking it.
- `invalidate` keeps a load already in flight in the process from storing its older value. Across processes, an older load can still store its value after the invalidation, until its TTL ends, so keep TTLs short for data that changes.

### One-time claims and single-use values

`jg-redis/coordination` is for security: replay protection for one-time codes, and values one request takes, such as a sign-in challenge. It fails closed, throwing `COORDINATION_FAILED` when Redis fails, instead of letting the request through.

```ts
import { connectRedis } from 'jg-redis';
import { claimOnce, storeSingleUseValue, takeSingleUseValue } from 'jg-redis/coordination';
import { z } from 'zod';

declare const redis: Awaited<ReturnType<typeof connectRedis>>;

// true for the first use of the code, false for a replay
const isFirstUse = await claimOnce(redis, 'user:42:used-otp', '123456', 90);

await storeSingleUseValue(redis, 'user-auth:challenge:9f86d081', { userId: '42' }, 300);
const challenge = await takeSingleUseValue(
  redis,
  'user-auth:challenge:9f86d081',
  z.object({ userId: z.string() }),
); // null once taken or expired
```

`claimOnce` stores only the token's SHA-256 hash. Name a single-use value's key after a hash of the token that finds it, never the token. A value that fails its schema throws `COORDINATION_VALUE_INVALID`, without a cause or the value, which might hold a secret.

These keys must never be evicted early, so run the server with `maxmemory-policy noeviction`, or keep them on a separate instance from the cache. Under `noeviction`, a full server rejects writes: the cache skips them, and coordination throws.

### Errors

| Code                         | When                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `INVALID_TTL`                | A time-to-live isn't a whole number of seconds, from 1          |
| `COORDINATION_FAILED`        | Redis couldn't complete a claim, a store, or a take             |
| `COORDINATION_VALUE_INVALID` | A single-use value isn't valid JSON or doesn't match its schema |

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-redis/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-redis/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-redis/LICENSE)
