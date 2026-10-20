# jg-nestjs recipes

Wiring the envelope, validation, and error reporting into a NestJS API, starting it, reporting failures, building the filter's options from the app's services, and adding maintenance mode or an IP blocklist.

## Wiring the filter, interceptor, and pipe

An app module that answers every request in the envelope, validates bodies with Zod, and keeps a token out of the URLs it logs.

```ts
import { Body, Controller, Module, Post } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  API_EXCEPTION_FILTER_OPTIONS,
  ApiException,
  ApiExceptionFilter,
  ApiResponseInterceptor,
  type IApiExceptionFilterOptions,
  SchemaValidationPipe,
} from 'jg-nestjs';
import { z } from 'zod';

// the app's own data access
declare const projects: {
  findByName: (name: string) => Promise<{ id: number } | undefined>;
  create: (name: string) => Promise<{ id: number; name: string }>;
};

const CreateProjectSchema = z.strictObject({ name: z.string().trim().min(1).max(64) });

@Controller('projects')
class ProjectsController {
  @Post()
  async create(@Body({ schema: CreateProjectSchema }) body: z.infer<typeof CreateProjectSchema>) {
    if ((await projects.findByName(body.name)) !== undefined) {
      throw new ApiException('A project with that name exists.', {
        code: 'PROJECT_NAME_TAKEN',
        status: 409,
        severity: 'expected',
      });
    }
    return projects.create(body.name);
  }
}

const filterOptions: IApiExceptionFilterOptions = {
  redactUrl: (url) => url.replace(/([?&]token=)[^&]*/, '$1[redacted]'),
};

@Module({
  controllers: [ProjectsController],
  providers: [
    { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: filterOptions },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_PIPE, useClass: SchemaValidationPipe },
  ],
})
export class AppModule {}
```

A taken name answers 409 with `PROJECT_NAME_TAKEN`, and an empty one 400 with `VALIDATION_FAILED` and the issue at `['name']`. Marking the conflict `expected` keeps it out of the reports, because it's the client's mistake, not the API's.

## Bootstrapping an HTTP app

The entry point of an API behind one load balancer, with security headers, URI versions, strict CORS, and a payment webhook that verifies its signature over the raw body.

```ts
import { ConsoleLogger, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { raw } from 'express';
import helmet from 'helmet';
import { configureHttpApp, createCorsOptions } from 'jg-nestjs';

// the app's root module
declare const AppModule: new () => object;

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({ prefix: 'API', logLevels: ['fatal', 'error', 'warn', 'log'] }),
    cors: createCorsOptions({ origins: ['https://app.example.com'] }),
  });

  // before configureHttpApp, so the JSON parser leaves this route's body as a Buffer
  app.use('/billing/webhooks', raw({ type: 'application/json', limit: '1mb' }));

  configureHttpApp(app, {
    bodyLimit: '1mb',
    securityMiddleware: helmet(),
    trustProxyHops: 1,
    requestLogging: { redactUrl: (url) => url.replace(/([?&]token=)[^&]*/, '$1[redacted]') },
    versioning: { type: VersioningType.URI },
  });
  await app.listen(3000);
};

void bootstrap();
```

`trustProxyHops: 1` trusts exactly the load balancer, so the request log and rate limits see the client's address from `X-Forwarded-For` without trusting addresses a client wrote into it. Shutdown hooks run on SIGINT and SIGTERM, so a container stop closes database pools before the process exits.

## Reporting errors to an error tracker

The filter hands each reportable error to `report` without waiting for it, so a slow or failing tracker never delays or changes the response. The tracker client here stands in for the one the app uses.

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter, type IErrorReport } from 'jg-nestjs';

// the app's error tracker client
declare const tracker: {
  capture: (error: unknown, context: Record<string, string | number>) => Promise<void>;
};

const report = async ({ error, status, severity, request, url }: IErrorReport): Promise<void> => {
  await tracker.capture(error, {
    level: severity === 'critical' ? 'fatal' : 'error',
    method: request.method ?? 'UNKNOWN',
    url,
    status,
  });
};

@Module({
  providers: [
    {
      provide: API_EXCEPTION_FILTER_OPTIONS,
      useValue: { report, ignoredStatuses: [401, 404, 429] },
    },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
```

Adding 404 to `ignoredStatuses` keeps requests for routes that don't exist, which crawlers send all day, out of the tracker. The URL is already redacted when `redactUrl` is set, and a tracker that throws is logged instead.

Without an external tracker, jg-postgres's error log keeps the errors in the app's own database, for an admin page to list. It never rejects, so `report` can await it:

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { createPostgres } from 'jg-postgres';
import { createErrorLog } from 'jg-postgres/error-log';
import { API_EXCEPTION_FILTER_OPTIONS, ApiExceptionFilter, type IErrorReport } from 'jg-nestjs';

declare const postgres: ReturnType<typeof createPostgres>;

const errorLog = createErrorLog(postgres, {
  origin: 'api',
  redactKeys: ['password', 'token', 'authorization'],
});

const report = async ({ error, request }: IErrorReport): Promise<void> => {
  const userId = (request as { user?: { id?: string } }).user?.id;
  await errorLog.record({ error, userInfo: userId === undefined ? null : { userId } });
};

@Module({
  providers: [
    { provide: API_EXCEPTION_FILTER_OPTIONS, useValue: { report } },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class ErrorLogModule {}
```

## Building the filter's options from injected services

`API_EXCEPTION_FILTER_OPTIONS` can come from any provider. When the reporter needs a service the app provides, such as its own error store, build the options with `useFactory` and list the service in `inject`:

```ts
import { Injectable, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import {
  API_EXCEPTION_FILTER_OPTIONS,
  ApiExceptionFilter,
  type IApiExceptionFilterOptions,
} from 'jg-nestjs';

// the app's own storage for errors
@Injectable()
class ErrorStore {
  public async save(entry: { code: string; status: number; url: string }): Promise<void> {
    await Promise.resolve(entry);
  }
}

@Module({
  providers: [
    ErrorStore,
    {
      provide: API_EXCEPTION_FILTER_OPTIONS,
      inject: [ErrorStore],
      useFactory: (store: ErrorStore): IApiExceptionFilterOptions => ({
        report: ({ error, status, url }) =>
          store.save({ code: (error as { code?: string }).code ?? 'UNKNOWN', status, url }),
        ignoredStatuses: [401, 404, 429],
      }),
    },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
```

The filter is created once, when the module starts, so the factory runs once and the reporter keeps the store it was given.

## Maintenance mode from a flag or a stored record

An environment flag is the simplest switch, but turning it on needs a redeploy. A stored record turns maintenance on and off at runtime; read it at most every few seconds, since the guard asks on every request. The state's `data` is what the client reads, and a route marked with `MaintenanceExempt()`, such as the admin's sign-in, stays up, because `getState` reads the route's metadata from its context:

```ts
import { type ExecutionContext, Module, SetMetadata } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { createPostgres } from 'jg-postgres';
import {
  type IMaintenanceModeState,
  MAINTENANCE_MODE_GUARD_OPTIONS,
  MaintenanceModeGuard,
} from 'jg-nestjs';

declare const postgres: ReturnType<typeof createPostgres>;

// how long a read record is reused, so requests don't each query the database
const STATE_MAX_AGE_MS = 5_000;

// the metadata a route sets to stay up during maintenance
const MAINTENANCE_EXEMPT = 'maintenance-exempt';
export const MaintenanceExempt = (): MethodDecorator & ClassDecorator =>
  SetMetadata(MAINTENANCE_EXEMPT, true);

let cached: { state: IMaintenanceModeState; readAt: number } | undefined;

const readStoredState = async (): Promise<IMaintenanceModeState> => {
  if (cached === undefined || Date.now() - cached.readAt > STATE_MAX_AGE_MS) {
    const [row] = await postgres.query<{
      is_enabled: boolean;
      content: string | null;
      updated_at: string;
    }>('SELECT is_enabled, content, updated_at FROM maintenance_setting WHERE id = 1;');
    cached = {
      state: {
        enabled: row?.is_enabled === true,
        // the client shows the notice and when it was set
        data: {
          maintenanceMode: { content: row?.content ?? null, updatedAt: row?.updated_at ?? null },
        },
      },
      readAt: Date.now(),
    };
  }
  return cached.state;
};

@Module({
  providers: [
    {
      provide: MAINTENANCE_MODE_GUARD_OPTIONS,
      useFactory: (reflector: Reflector) => ({
        getState: async (context: ExecutionContext): Promise<IMaintenanceModeState> => {
          const isExempt = reflector.getAllAndOverride<boolean | undefined>(MAINTENANCE_EXEMPT, [
            context.getHandler(),
            context.getClass(),
          ]);
          if (isExempt === true) {
            return { enabled: false };
          }
          // the flag wins, so maintenance can be forced on even with the database down
          if (process.env['MAINTENANCE_MODE'] === 'true') {
            return { enabled: true, message: 'The service is down for maintenance.' };
          }
          return readStoredState();
        },
      }),
      inject: [Reflector],
    },
    { provide: APP_GUARD, useClass: MaintenanceModeGuard },
  ],
})
export class AppModule {}
```

When the database can't be read, the guard fails closed and the filter answers with a reported 500, so set the flag for maintenance that takes the database down. A second switch, such as a restore that takes every route down, fits in the same `getState`: return `enabled: true` before the exemption check while it's on.

## An IP blocklist in Redis

jg-redis's `createBlocklist` keeps the blocked addresses in a Redis SET, which the guard checks on every request:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IP_BLOCKLIST_GUARD_OPTIONS, IpBlocklistGuard, normalizeIp } from 'jg-nestjs';
import { connectRedis, createBlocklist } from 'jg-redis';

declare const redis: Awaited<ReturnType<typeof connectRedis>>;

const ipBlocklist = createBlocklist(redis, { key: 'ip-blocklist' });

// blocks an address, normalized the way the guard checks it
export const blockIp = (ip: string): Promise<void> => ipBlocklist.add([normalizeIp(ip)]);

@Module({
  providers: [
    { provide: IP_BLOCKLIST_GUARD_OPTIONS, useValue: { isBlocked: ipBlocklist.has } },
    { provide: APP_GUARD, useClass: IpBlocklistGuard },
  ],
})
export class AppModule {}
```

When Redis fails, `has` throws `BLOCKLIST_FAILED`, and the guard refuses the request, which the filter reports. A flush or an eviction empties the list instead, which lets everyone through, so keep the list in a database and restore it at boot, as jg-redis's recipe shows.
