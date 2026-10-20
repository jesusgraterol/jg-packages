# jg-nestjs

NestJS for HTTP APIs: an ApiException, a filter and an interceptor for the jg-api-response envelope, schema validation, CORS, and app bootstrap.

## Install

```bash
npm install jg-nestjs
```

It needs `@nestjs/common`, `@nestjs/core`, and `@nestjs/platform-express` 12, and `rxjs` 7.8. It injects its dependencies with explicit tokens, so an app needs only `experimentalDecorators`, not `emitDecoratorMetadata`.

## Usage

### Answering in one envelope

Register the filter and the interceptor once, and every response uses the `{ success, data, error }` envelope from [jg-api-response](https://jg-packages.jesusgraterol.dev/packages/jg-api-response/):

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ApiExceptionFilter, ApiResponseInterceptor, SchemaValidationPipe } from 'jg-nestjs';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_PIPE, useClass: SchemaValidationPipe },
  ],
})
export class AppModule {}
```

A handler's result becomes `{ success: true, data, error: null }`, and a 204 sends no body. An error becomes `{ success: false, error: { code, message, data } }`:

| Error                                                                                                 | Status                         | What the client sees                                                  |
| ----------------------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `ApiException`                                                                                        | its `status`, 400 to 599       | its code, message, and data                                           |
| Another `Exception`, such as a jg package's                                                           | from `resolveStatus`, else 500 | its code, message, and data                                           |
| Nest's `HttpException`                                                                                | its status                     | `HTTP_EXCEPTION`, with its message                                    |
| A client error Express's middleware built for clients (`expose: true`), such as a body over the limit | its 4xx `statusCode`           | `HTTP_EXCEPTION`, with its message                                    |
| Anything else                                                                                         | from `resolveStatus`, else 500 | `INTERNAL_ERROR` and a generic message, never the error's own message |

Throw an `ApiException` for failures the client should understand:

```ts
import { ApiException } from 'jg-nestjs';

throw new ApiException('The project was not found.', {
  code: 'PROJECT_NOT_FOUND',
  status: 404,
  severity: 'expected',
});
```

Define a module's errors once with `defineApiErrorCatalog`, so every throw site uses the same code, message, status, and severity, and a handler recognizes them by kind:

```ts
import { defineApiErrorCatalog } from 'jg-nestjs';

const projectErrors = defineApiErrorCatalog({
  notFound: {
    code: 'PROJECT_NOT_FOUND',
    message: 'The project was not found.',
    status: 404,
    severity: 'expected',
  },
  unavailable: { code: 'PROJECTS_UNAVAILABLE', message: 'Projects are unavailable.', status: 503 },
});

throw projectErrors.create('notFound', { data: { id: 42 } });
```

`is(error, kind?)` compares codes, as jg-exception's `defineErrorCatalog` does, so it also recognizes the error after it crossed a package boundary.

### Logging and reporting

The filter logs, through Nest's `Logger`, an error whose throw site set `shouldLog` or `severity: 'critical'`, and any error that is none of an `Exception`, an `HttpException`, and a client error Express's middleware built for clients, with the method, the redacted URL, and the status. A `report` option sends errors to an error tracker, except those with `severity: 'expected'`, the statuses in `ignoredStatuses` (401 and 429 by default), and the codes in `ignoredCodes` (`CORS_ORIGIN_NOT_ALLOWED`, `MAINTENANCE_MODE`, `IP_BLOCKED`, `UPLOAD_REJECTED`, and `TURNSTILE_FAILED` by default). Provide the options as `API_EXCEPTION_FILTER_OPTIONS`, through any provider: `useValue` for fixed options, or `useFactory` with `inject` when the reporter needs the app's own services, as [a recipe](RECIPES.md#building-the-filters-options-from-injected-services) shows. `redactUrl` removes secrets from URLs before either sees them.

### Validating input

`SchemaValidationPipe` validates each parameter that declares a Standard Schema, such as a Zod schema in `@Body({ schema })`. Invalid input gets a 400 with `VALIDATION_FAILED` and up to 32 `{ path, message }` issues as its data, and a valid parameter becomes the schema's output, without `__proto__` keys.

### CORS

```ts
app.enableCors(createCorsOptions({ origins: ['https://app.example.com'] }));
```

It allows the listed origins exactly, their `www.` variants, and requests without an `Origin` header, which servers and command-line clients send, unless `allowOriginless` is false. Any other origin gets a 403 with `CORS_ORIGIN_NOT_ALLOWED`, through the filter, and isn't reported.

### Maintenance mode and IP blocklists

`MaintenanceModeGuard` refuses requests with a 503, `MAINTENANCE_MODE`, while `getState` says maintenance is on. The error's data is the state's `data`, as it is, such as `{ maintenanceMode: { content, updatedAt } }` for a client that shows the notice, or else `{ message }` when the state has only a `message`. `getState` receives the request's `ExecutionContext`, so one guard can keep some routes up, such as an admin sign-in, by reading their metadata with a `Reflector`, as [a recipe](RECIPES.md#maintenance-mode-from-a-flag-or-a-stored-record) shows. `IpBlocklistGuard` refuses requests from blocked addresses with a 403, `IP_BLOCKED`, without echoing the address. Each reads its options from its own token, and the app fails to start without them:

```ts
import { Module } from '@nestjs/common';
import {
  IP_BLOCKLIST_GUARD_OPTIONS,
  IpBlocklistGuard,
  MAINTENANCE_MODE_GUARD_OPTIONS,
  MaintenanceModeGuard,
} from 'jg-nestjs';

@Module({
  providers: [
    {
      provide: MAINTENANCE_MODE_GUARD_OPTIONS,
      useValue: { getState: () => ({ enabled: process.env['MAINTENANCE_MODE'] === 'true' }) },
    },
    {
      provide: IP_BLOCKLIST_GUARD_OPTIONS,
      useValue: { isBlocked: (ip: string) => ipBlocklist.has(ip) },
    },
  ],
})
export class AppModule {}
```

`IpBlocklistGuard` checks Express's `request.ip`, which follows `configureHttpApp`'s `trustProxyHops`, or what a `getIp` option returns, after `normalizeIp`: trimmed, lowercased, and `::ffff:203.0.113.7` as `203.0.113.7`. Normalize addresses the same way when adding them to the list. A request without an address goes through. Both guards fail closed: an error from `getState` or `isBlocked` refuses the request, which the filter answers with a 500 and reports. Other contexts, such as microservices, pass.

Run the cheap refusals first, so a flood or a blocked client never reaches authentication: the rate limiter, then `IpBlocklistGuard`, then `MaintenanceModeGuard`, then authentication. Guards in one `@UseGuards(ThrottlerGuard, IpBlocklistGuard, MaintenanceModeGuard, AuthGuard)` run in that order, and so do `APP_GUARD` providers, in the order they're listed. A route that must stay up during maintenance, such as a health check, leaves `MaintenanceModeGuard` out.

### Uploads

`createUploadInterceptor` receives one file into memory, as Nest's `FileInterceptor` does with `@UploadedFile()`, under limits. Call it once at module scope: each call has its own slots, shared by every route that uses the class.

```ts
import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { createUploadInterceptor } from 'jg-nestjs';

const AudioUpload = createUploadInterceptor({
  field: 'audio',
  maxBytes: 25_000_000,
  maxConcurrent: 2,
  uploadTimeoutSeconds: 120,
});

@Controller('transcriptions')
export class TranscriptionsController {
  @Post()
  @UseInterceptors(AudioUpload)
  public create(@UploadedFile() file: { buffer: Buffer; mimetype: string }) {
    return transcribe(file.buffer, file.mimetype);
  }
}
```

The file may hold exactly `maxBytes`, and the request may send no other part. A request takes a slot before its upload starts and gives it back when the handler ends, so `maxConcurrent` also bounds the work after the upload; a request beyond the slots gets a 503 with `UPLOAD_CAPACITY_FULL`, which is reported. A file over the limit gets a 413, and another field or a malformed body a 400, with `UPLOAD_REJECTED`, which isn't. An upload still arriving after `uploadTimeoutSeconds` has its connection closed, and an abandoned one gives its slot back at once. A limit that isn't a positive integer, or a timeout of 0 or more than `2_147_483` seconds, the longest a timer waits, throws `INVALID_UPLOAD_OPTIONS` at once, so a limit read from a missing variable never turns into no limit.

### Human verification with Turnstile

`TurnstileGuard`, from `jg-nestjs/turnstile`, lets a request through only when the Cloudflare Turnstile token in its `x-turnstile-token` header verifies with siteverify, on one of the allowed hostnames, and for the action a route sets with `@TurnstileAction`:

```ts
import { Body, Controller, Module, Post, UseGuards } from '@nestjs/common';
import { TURNSTILE_GUARD_OPTIONS, TurnstileAction, TurnstileGuard } from 'jg-nestjs/turnstile';

@Controller('contact')
class ContactController {
  @Post()
  @UseGuards(TurnstileGuard)
  @TurnstileAction('contact')
  public send(@Body() message: unknown) {
    return sendContactMessage(message);
  }
}

@Module({
  controllers: [ContactController],
  providers: [
    {
      provide: TURNSTILE_GUARD_OPTIONS,
      useValue: { secretKey: turnstileSecretKey, allowedHostnames: ['www.example.com'] },
    },
    TurnstileGuard,
  ],
})
export class ContactModule {}
```

A missing, invalid, expired, or reused token, or one solved on another hostname or for another action, gets a 403 with `TURNSTILE_FAILED`, which isn't reported. When siteverify can't be reached, fails, or refuses the secret key, the request gets a 503 with `TURNSTILE_UNAVAILABLE`, which is reported with the reason as its cause. Neither tells the client what Cloudflare answered. Siteverify is called through [jg-fetch](https://jg-packages.jesusgraterol.dev/packages/jg-fetch/), which retries a network error, a timeout, or a 5xx with the same idempotency key, so a token is verified once. Each token verifies once, so the page resets its widget after every request.

### Bootstrapping an app

`configureHttpApp` sets up an Express-based app before it listens, always in this order: JSON and URL-encoded body parsers with `bodyLimit`, the security middleware, the trusted proxy hops, the request log, versioning, and shutdown hooks on SIGINT and SIGTERM:

```ts
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { raw } from 'express';
import helmet from 'helmet';
import { configureHttpApp, listenHttpApp } from 'jg-nestjs';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
// a webhook that checks a signature needs the exact bytes, so its parser comes first
app.use('/billing/webhooks', raw({ type: 'application/json', limit: '1mb' }));
configureHttpApp(app, { bodyLimit: '1mb', securityMiddleware: helmet(), trustProxyHops: 1 });
await listenHttpApp(app, { port: 3000 });
```

`listenHttpApp` closes the app when it can't listen, such as when the port is taken, so the modules' shutdown hooks release what they opened before the error reaches the caller, and it logs a failure to close. Import `PingModule` for `GET /ping`, which answers 204 with no body whatever version the request asks for, for a load balancer's health check.

The request log writes `METHOD url status Nms` through Nest's `Logger` once each response finishes, at `error` for a 5xx, `warn` for a 4xx, and `log` otherwise, with the client's address, user agent, referer, and response size as structured fields. Its `redactUrl` option cleans the URL and the referer first, and `createRequestLoggingMiddleware` gives the same middleware on its own. The prefix and the levels Nest prints belong to Nest's own logger: `NestFactory.create(AppModule, { logger: new ConsoleLogger({ prefix: 'API', logLevels: ['fatal', 'error', 'warn', 'log'] }) })`.

### Errors

| Code                      | When                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `VALIDATION_FAILED`       | A parameter didn't match its schema                                                                                                                                      |
| `HTTP_EXCEPTION`          | A handler, guard, or Nest itself threw an `HttpException`, such as a 404, or Express's middleware refused the request with a client error, such as a body over the limit |
| `INTERNAL_ERROR`          | An error the filter doesn't recognize, such as a failed database call, reached it                                                                                        |
| `CORS_ORIGIN_NOT_ALLOWED` | A browser called from an origin the API doesn't allow                                                                                                                    |
| `MAINTENANCE_MODE`        | `MaintenanceModeGuard` refused a request while maintenance is on, with a 503                                                                                             |
| `IP_BLOCKED`              | `IpBlocklistGuard` refused a request from a blocked address, with a 403                                                                                                  |
| `UPLOAD_CAPACITY_FULL`    | `createUploadInterceptor`'s slots were all taken, with a 503                                                                                                             |
| `UPLOAD_REJECTED`         | An upload was too large, with a 413, or sent another part or a malformed body, with a 400                                                                                |
| `INVALID_UPLOAD_OPTIONS`  | `createUploadInterceptor` was given a limit that isn't a positive integer, or a timeout of 0 or more than `2_147_483` seconds, thrown at once                            |
| `TURNSTILE_FAILED`        | `TurnstileGuard` refused a token that didn't verify, with a 403                                                                                                          |
| `TURNSTILE_UNAVAILABLE`   | `TurnstileGuard` couldn't verify a token, with a 503                                                                                                                     |

`ERROR_MESSAGES` holds each code's message.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-nestjs/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-nestjs/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-nestjs/LICENSE)
