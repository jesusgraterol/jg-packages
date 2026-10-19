# Changelog

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `ApiException`, an `Exception` with the HTTP `status`, from 400 to 599, that its response gets. `IApiExceptionOptions` types its options.
- `ApiExceptionFilter`, which answers every HTTP error in the jg-api-response envelope. A client error Express's middleware built for clients, such as a body over the limit, keeps its 4xx, and an error it doesn't recognize never sends its message. It logs unexpected, `shouldLog`, and critical errors, and hands reportable errors to a `report` option. `API_EXCEPTION_FILTER_OPTIONS`, `IApiExceptionFilterOptions`, and `IErrorReport` configure it.
- `ApiResponseInterceptor`, which wraps HTTP results in the success envelope.
- `SchemaValidationPipe`, which validates parameters with their Standard Schema and answers invalid input with a 400 `VALIDATION_FAILED` and its issues.
- `createCorsOptions`, which allows only the listed origins, and refuses others with a 403 `CORS_ORIGIN_NOT_ALLOWED`. `ICorsOptionsInput` configures it.
- `configureHttpApp`, which sets up an Express-based app in a fixed order: body parsers with a limit, security middleware, trusted proxy hops, the request log, versioning, and shutdown hooks. `IHttpAppOptions` configures it.
- `createRequestLoggingMiddleware`, which logs each finished request through Nest's `Logger` at a level that follows its status, with redacted URLs. `IRequestLoggingOptions` configures it.
- `ERRORS` and `ERROR_MESSAGES`: `VALIDATION_FAILED`, `HTTP_EXCEPTION`, `INTERNAL_ERROR`, and `CORS_ORIGIN_NOT_ALLOWED`.
