# Changelog

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
