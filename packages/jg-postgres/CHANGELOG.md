# Changelog

## 0.2.0

### Added

- `defineTimeoutProfile({ statementTimeoutSeconds, lockTimeoutSeconds, queryGraceSeconds? })`, a frozen profile of how long a kind of work may run, whose client timeout is the statement timeout plus a grace, 15 seconds by default. `toPoolTimeouts(profile)` gives it to `createPostgres`, and `withQueryTimeout(query, profile)` gives one query its client timeout. A profile that isn't valid throws `INVALID_TIMEOUT_PROFILE`.
- `transaction(operation, { timeouts })`, which sets a profile's statement and lock timeouts for that transaction only.
- `createOptionalReader(options)`, which runs optional reads, such as a header's counters, only while the pool has spare clients, shares a running read by its key, gives up after `admissionSeconds`, and never throws. Options that aren't valid throw `INVALID_OPTIONAL_READ_OPTIONS`.
- `ITimeoutProfile`, `ITransactionOptions`, `IOptionalRead`, `IOptionalReader`, and `IOptionalReaderOptions`.
- A recipe for a slow transaction with its own timeouts.

## 0.1.1

### Changed

- Published from CI with provenance, which 0.1.0, published by hand as the package's first version, lacks. The code is the same.

## 0.1.0

### Added

- `createPostgres`, a node-postgres pool with its own value parsers (`NUMERIC` as a number, `TIMESTAMPTZ` as an ISO 8601 UTC string, `BIGINT` as a string), errors no caller awaits sent to `onError`, and `query`, `transaction`, and `close`. A connection lost during `COMMIT` rejects with `TRANSACTION_OUTCOME_UNKNOWN`.
- Checks for PostgreSQL's SQLSTATE codes, such as `isUniqueViolationError`, with an optional constraint name.
- Advisory locks: `createAdvisoryLockKey`, `lockTransaction`, and `withSessionLock`.
- Cursor pages, with `listByCursor` and `buildCursorPage`, and ordered lists, with `moveUp`, `moveDown`, and `lockOrderedList`, every name quoted with `quoteIdentifier`.
- `POSTGRES_BIGINT_MIN` and `POSTGRES_BIGINT_MAX`.
- `jg-postgres/record-store`'s `createRecordStore`, which keeps a JSON record, with defaults and a schema, in a `record_store` table the README describes: `get`, `set`, and atomic `incrementNumber` and `setNumber`, each optionally in a caller's transaction.
