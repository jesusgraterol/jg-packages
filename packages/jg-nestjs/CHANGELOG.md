# Changelog

## 0.3.0

### Added

- `IMaintenanceModeState`'s optional `data`, which `MaintenanceModeGuard` sends as the 503 error's data as it is, in place of `{ message }`, such as `{ maintenanceMode: { content, updatedAt } }` for a client that shows the notice.
- `getState` receives the request's `ExecutionContext`, so one guard can keep some routes up by their metadata. A `getState` that takes no argument still fits.
- Recipes for a per-route exemption from maintenance mode, and for reporting errors to jg-postgres's error log.

## 0.2.0

### Added

- `MaintenanceModeGuard`, which refuses HTTP requests with a 503 `MAINTENANCE_MODE` while the `getState` option, read on every request, says maintenance is on, with the state's message as the error's data. Its options come from `MAINTENANCE_MODE_GUARD_OPTIONS`.
- `IpBlocklistGuard`, which refuses HTTP requests from blocked addresses with a 403 `IP_BLOCKED`, checking Express's `request.ip`, or a `getIp` option's address, normalized by `normalizeIp`. Its options come from `IP_BLOCKLIST_GUARD_OPTIONS`.
- `normalizeIp(ip)`, which trims and lowercases an address, and turns an IPv4 address mapped into IPv6 into plain IPv4.
- Both guards fail closed, refusing a request when their callback throws, and let other contexts, such as microservices, through.
- `IMaintenanceModeGuardOptions`, `IMaintenanceModeState`, `IIpBlocklistGuardOptions`, and `IIpBlocklistRequest`.
- README guidance on the guards' order, and recipes for maintenance mode from a flag or a stored record, and for an IP blocklist in Redis.

### Changed

- `ApiExceptionFilter` doesn't report `MAINTENANCE_MODE` and `IP_BLOCKED` by default, as it doesn't report `CORS_ORIGIN_NOT_ALLOWED`. An app that sets `ignoredCodes` lists every code it ignores.

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
