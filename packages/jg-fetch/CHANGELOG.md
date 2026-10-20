# Changelog

## 0.4.0

### Changed

- Supports Node.js 22.17.0 and later, down from 24.

## 0.3.0

### Added

- `FetchException` inherits `severity` and `shouldLog` from jg-exception 1.4.0's `Exception`, for an app's own throw sites and reporters. jg-fetch never sets them.
- `refreshCredentials` and `maxCredentialRefreshes` in `request`'s options. When an attempt fails with a response, such as a `401`, `refreshCredentials` receives an `ICredentialFailure`, `{ status, code, refreshes, signal }`, and returning `true` repeats the attempt at once, for any method, without using up a retry, up to `maxCredentialRefreshes` times, 1 by default. A streamed body never asks it. A refresh that throws ends the call with the new `CREDENTIALS_REFRESH_FAILED` kind, and one that outlives the call ends as `TIMEOUT` or `ABORTED`.

### Changed

- The recipe "A fresh auth header on every request" refreshes the token with `refreshCredentials` instead of sending the request again by hand.

## 0.2.2

### Fixed

- A body that isn't a plain object, an array, or one `fetch` sends as it is (a string, `Blob`, `ArrayBuffer` or view of one, `FormData`, `URLSearchParams`, or `ReadableStream`) fails with `INVALID_BODY` before the request is sent. Before, `fetch` sent a `Map` as `[object Map]`, a function as its source, and a number as its digits, and a `Symbol` failed as `INVALID_OPTIONS`.

## 0.2.1

### Added

- `RECIPES.md`, patterns for apps that use the package: a typed client for an envelope API, a fresh auth header on every request, and retrying only what's safe to retry. Each block is typechecked against the release.

## 0.2.0

### Added

- `API.md`, the full API reference, generated from the TSDoc of the version it ships with, so it can be read from `node_modules` without a browser.

### Changed

- An `API_ERROR` reads the envelope's `error` as `{ code, message, data }`, as `jg-api-response` 1.1.0 builds it: the `FetchException` gets that code, message, and data, and `body` keeps the whole envelope. Without an error object, the code is `API_ERROR`, the message is the default, and `data` is `null`.
- An envelope whose `error` is a string is no longer an envelope, so a successful status with one reports `ENVELOPE_INVALID`.
- `FetchException` is built on `jg-exception` 1.1.0, so `toJSON()` and `toString()` follow it, and `data` is a JSON value.
- `INVALID_BODY` uses its default message and keeps JSON's error as `cause`, instead of adding that error's message, which can name the body's keys.
- `IResponseSchema` is renamed `ISchema`, the name every package uses for its `schema` option.

### Fixed

- A `headers` callback that never settles no longer holds the request past its timeout: its result is raced against the attempt's signal, so the call ends as `TIMEOUT`, the attempt's timeout retries, and the caller's abort ends it as `ABORTED`. While it waits, Node.js stays running until the timeout, even with nothing else to do.
- A fractional `timeoutSeconds` or `attemptTimeoutSeconds`, such as `0.0015`, no longer makes `request` reject: timeouts are rounded up to whole milliseconds, with a minimum of 1.

## 0.1.1

### Changed

- Published by CI from `jesusgraterol/jg-packages`, with npm provenance. The code is the same as 0.1.0.

## 0.1.0

The first release: one fetch wrapper for browsers and Node.js.

### Added

- `request`, which never throws and resolves to `{ data, error, meta }`, with `parseAs` modes whose data types follow them: `envelope`, `json`, `text`, `bytes`, `blob`, `response`, and `none`.
- Timeouts for the whole call and for each attempt, retries with `Retry-After`, a response size cap, schemas, and headers built for every attempt.
- `FetchException`, with the failure's `kind`, the API's `code`, the response's status, headers, and body, and the request's method, URL, attempts, and duration.
- `parseRetryAfterMs`, `ERRORS`, and the default constants.
