# Changelog

## 0.1.0

### Added

- `createPostgres`, a node-postgres pool with its own value parsers (`NUMERIC` as a number, `TIMESTAMPTZ` as an ISO 8601 UTC string, `BIGINT` as a string), errors no caller awaits sent to `onError`, and `query`, `transaction`, and `close`. A connection lost during `COMMIT` rejects with `TRANSACTION_OUTCOME_UNKNOWN`.
- Checks for PostgreSQL's SQLSTATE codes, such as `isUniqueViolationError`, with an optional constraint name.
- Advisory locks: `createAdvisoryLockKey`, `lockTransaction`, and `withSessionLock`.
- Cursor pages, with `listByCursor` and `buildCursorPage`, and ordered lists, with `moveUp`, `moveDown`, and `lockOrderedList`, every name quoted with `quoteIdentifier`.
- `POSTGRES_BIGINT_MIN` and `POSTGRES_BIGINT_MAX`.
