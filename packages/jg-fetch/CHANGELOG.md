# Changelog

## 0.2.0

### Changed

- An `API_ERROR` reads the envelope's `error` as `{ code, message, data }`, as `jg-api-response` 1.1.0 builds it: the `FetchException` gets that code, message, and data, and `body` keeps the whole envelope. Without an error object, the code is `API_ERROR`, the message is the default, and `data` is `null`.
- An envelope whose `error` is a string is no longer an envelope, so a successful status with one reports `ENVELOPE_INVALID`.
- `FetchException` is built on `jg-exception` 1.1.0, so `toJSON()` and `toString()` follow it, and `data` is a JSON value.
- `INVALID_BODY` uses its default message and keeps JSON's error as `cause`, instead of adding that error's message, which can name the body's keys.
- `ISchema` is renamed `ISchema`, the name every package uses for its `schema` option.

### Fixed

- A `headers` callback that never settles no longer holds the request past its timeout: its result is raced against the attempt's signal, so the call ends as `TIMEOUT`, the attempt's timeout retries, and the caller's abort ends it as `ABORTED`. While it waits, Node.js stays running until the timeout, even with nothing else to do.
- A fractional `timeoutSeconds` or `attemptTimeoutSeconds`, such as `0.0015`, no longer makes `request` reject: timeouts are rounded up to whole milliseconds, with a minimum of 1.

## 0.1.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 0.1.0.

## 0.1.0

The first release of `jg-fetch`, which replaces `fetch-request-browser` and `fetch-request-node` 1.1.0 with one package for browsers and Node.js.

### Added

- `request`, which never throws and resolves to `{ data, error, meta }`, with `parseAs` modes whose data types follow them: `envelope`, `json`, `text`, `bytes`, `blob`, `response`, and `none`.
- Timeouts for the whole call and for each attempt, retries with `Retry-After`, a response size cap, schemas, and headers built for every attempt.
- `FetchException`, with the failure's `kind`, the API's `code`, the response's status, headers, and body, and the request's method, URL, attempts, and duration.
- `parseRetryAfterMs`, `ERRORS`, and the default constants.
