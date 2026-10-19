# jg-redis recipes

Patterns for services that use Redis: wiring the client into an app, caching a slow query, stopping a one-time code's replay, and keeping an IP blocklist.

## A NestJS module

Connect the client once, at startup, provide it under a token, and close it when the app shuts down:

```ts
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { createEnvironmentReader } from 'jg-env';
import { connectRedis, createCache } from 'jg-redis';

const { readInteger, readString } = createEnvironmentReader(process.env);

// the tokens services inject the client and the cache with, as @Inject(REDIS)
export const REDIS = Symbol('REDIS');
export const CACHE = Symbol('CACHE');

const redis = await connectRedis({
  socket: { host: readString('REDIS_HOST'), port: readInteger('REDIS_PORT') },
  password: readString('REDIS_PASSWORD'),
});

@Module({
  providers: [
    { provide: REDIS, useValue: redis },
    { provide: CACHE, useValue: createCache(redis) },
  ],
  exports: [REDIS, CACHE],
})
export class RedisModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await redis.close();
  }
}
```

The module connects when it's first imported, so a server that can't be reached stops the app at startup, which top-level `await` needs an ES module for.

## Caching a slow query

Cache what's slow to compute and fine to serve a little stale, and invalidate it when the data changes:

```ts
import { connectRedis, createCache } from 'jg-redis';
import { z } from 'zod';

declare const redis: Awaited<ReturnType<typeof connectRedis>>;
declare const queryLeaderboard: (seasonId: string) => Promise<{ userId: string; points: number }[]>;

const cache = createCache(redis);
const LeaderboardSchema = z.array(z.object({ userId: z.string(), points: z.number() }));

export const getLeaderboard = (seasonId: string) =>
  cache.getOrLoad(`season:${seasonId}:leaderboard`, {
    schema: LeaderboardSchema,
    ttlSeconds: 60,
    load: () => queryLeaderboard(seasonId),
  });

export const onPointsAwarded = (seasonId: string) =>
  cache.invalidate(`season:${seasonId}:leaderboard`);
```

When a thousand requests miss at once, one query runs and every request gets its result. If Redis is down, each request runs the query itself.

## Stopping a one-time code's replay

A one-time code is valid for a short window, so one intercepted code could be used twice inside it. Claim each code after checking it, and reject a second claim:

```ts
import { Exception } from 'jg-exception';
import { connectRedis } from 'jg-redis';
import { claimOnce } from 'jg-redis/coordination';

declare const redis: Awaited<ReturnType<typeof connectRedis>>;
declare const isOtpValid: (secret: string, code: string) => boolean;

export const verifyOtp = async (userId: string, secret: string, code: string): Promise<void> => {
  if (!isOtpValid(secret, code)) {
    throw new Exception('The code is not valid.', { code: 'OTP_INVALID' });
  }
  // longer than the code stays valid, so it can't come back once the claim expires
  if (!(await claimOnce(redis, `user:${userId}:used-otp`, code, 120))) {
    throw new Exception('The code was already used.', { code: 'OTP_REPLAYED' });
  }
};
```

When Redis fails, `claimOnce` throws `COORDINATION_FAILED`, so the sign-in fails instead of accepting a code that may have been used.

## An IP blocklist backed by a database

Redis answers the check on every request, but a flush or an eviction would empty the list and let every blocked address back in. Keep the list in a table, the source of truth:

```sql
CREATE TABLE ip_blocklist (
  ip varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_ib__ip PRIMARY KEY (ip),
  CONSTRAINT chk_ib__ip_non_empty CHECK (ip <> '')
);
```

Write the table first, then Redis, and restore Redis from the table at boot and every few minutes:

```ts
import { createPostgres } from 'jg-postgres';
import { connectRedis, createBlocklist } from 'jg-redis';

declare const postgres: ReturnType<typeof createPostgres>;
declare const redis: Awaited<ReturnType<typeof connectRedis>>;

const ipBlocklist = createBlocklist(redis, { key: 'ip-blocklist' });

// lowercased, and an IPv4-mapped IPv6 address as plain IPv4, the same as the check
const normalizeIp = (ip: string): string => {
  const lowered = ip.trim().toLowerCase();
  return lowered.startsWith('::ffff:') && lowered.includes('.') ? lowered.slice(7) : lowered;
};

export const blockIp = async (ip: string): Promise<void> => {
  const normalized = normalizeIp(ip);
  await postgres.query('INSERT INTO ip_blocklist (ip) VALUES ($1) ON CONFLICT (ip) DO NOTHING;', [
    normalized,
  ]);
  await ipBlocklist.add([normalized]);
};

export const unblockIp = async (ip: string): Promise<void> => {
  const normalized = normalizeIp(ip);
  await postgres.query('DELETE FROM ip_blocklist WHERE ip = $1;', [normalized]);
  await ipBlocklist.remove([normalized]);
};

// at boot, and on a schedule, so a flush, an eviction, or a failed write heals
export const syncIpBlocklist = async (): Promise<void> => {
  const rows = await postgres.query<{ ip: string }>('SELECT ip FROM ip_blocklist;');
  await ipBlocklist.replaceAll(rows.map(({ ip }) => ip));
};
```

When the Redis write fails after the table's, the change reaches Redis with the next sync: a new block waits until then, and an unblocked address stays blocked until then, which errs on the safe side. jg-nestjs's `normalizeIp` normalizes the same way, for the guard that checks the list.
