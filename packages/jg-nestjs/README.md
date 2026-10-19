# jg-nestjs

NestJS for HTTP APIs: an ApiException, a filter and an interceptor that answer in the jg-api-response envelope, schema validation, and strict CORS.

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

| Error                                       | Status                         | What the client sees                                                  |
| ------------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| `ApiException`                              | its `status`, 400 to 599       | its code, message, and data                                           |
| Another `Exception`, such as a jg package's | from `resolveStatus`, else 500 | its code, message, and data                                           |
| Nest's `HttpException`                      | its status                     | `HTTP_EXCEPTION`, with its message                                    |
| Anything else                               | from `resolveStatus`, else 500 | `INTERNAL_ERROR` and a generic message, never the error's own message |

Throw an `ApiException` for failures the client should understand:

```ts
import { ApiException } from 'jg-nestjs';

throw new ApiException('The project was not found.', {
  code: 'PROJECT_NOT_FOUND',
  status: 404,
  severity: 'expected',
});
```

### Logging and reporting

The filter logs, through Nest's `Logger`, an error whose throw site set `shouldLog` or `severity: 'critical'`, and any error that is neither an `Exception` nor an `HttpException`, with the method, the redacted URL, and the status. A `report` option sends errors to an error tracker, except those with `severity: 'expected'`, the statuses in `ignoredStatuses` (401 and 429 by default), and the codes in `ignoredCodes` (`CORS_ORIGIN_NOT_ALLOWED` by default). Provide the options as `API_EXCEPTION_FILTER_OPTIONS`; `redactUrl` removes secrets from URLs before either sees them.

### Validating input

`SchemaValidationPipe` validates each parameter that declares a Standard Schema, such as a Zod schema in `@Body({ schema })`. Invalid input gets a 400 with `VALIDATION_FAILED` and up to 32 `{ path, message }` issues as its data, and a valid parameter becomes the schema's output, without `__proto__` keys.

### CORS

```ts
app.enableCors(createCorsOptions({ origins: ['https://app.example.com'] }));
```

It allows the listed origins exactly, their `www.` variants, and requests without an `Origin` header, which servers and command-line clients send, unless `allowOriginless` is false. Any other origin gets a 403 with `CORS_ORIGIN_NOT_ALLOWED`, through the filter, and isn't reported.

### Errors

| Code                      | When                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `VALIDATION_FAILED`       | A parameter didn't match its schema                                         |
| `HTTP_EXCEPTION`          | A handler, guard, or Nest itself threw an `HttpException`, such as a 404    |
| `INTERNAL_ERROR`          | An error that isn't an `Exception` or an `HttpException` reached the filter |
| `CORS_ORIGIN_NOT_ALLOWED` | A browser called from an origin the API doesn't allow                       |

`ERROR_MESSAGES` holds each code's message.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-nestjs/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-nestjs/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-nestjs/LICENSE)
