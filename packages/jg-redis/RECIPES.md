# jg-redis recipes

Patterns for services that use Redis as a cache and for one-time claims: wiring the client into an app, caching a slow query, and stopping a one-time code's replay.

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
