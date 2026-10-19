# Changelog

## 0.1.0

### Added

- `ApiException`, an `Exception` with the HTTP `status`, from 400 to 599, that its response gets. `IApiExceptionOptions` types its options.
- `ApiExceptionFilter`, which answers every HTTP error in the jg-api-response envelope, never sending the message of an error that isn't an `Exception` or an `HttpException`, logs unexpected, `shouldLog`, and critical errors, and hands reportable errors to a `report` option. `API_EXCEPTION_FILTER_OPTIONS`, `IApiExceptionFilterOptions`, and `IErrorReport` configure it.
- `ApiResponseInterceptor`, which wraps HTTP results in the success envelope.
- `SchemaValidationPipe`, which validates parameters with their Standard Schema and answers invalid input with a 400 `VALIDATION_FAILED` and its issues.
- `createCorsOptions`, which allows only the listed origins, and refuses others with a 403 `CORS_ORIGIN_NOT_ALLOWED`. `ICorsOptionsInput` configures it.
- `ERRORS` and `ERROR_MESSAGES`: `VALIDATION_FAILED`, `HTTP_EXCEPTION`, `INTERNAL_ERROR`, and `CORS_ORIGIN_NOT_ALLOWED`.
