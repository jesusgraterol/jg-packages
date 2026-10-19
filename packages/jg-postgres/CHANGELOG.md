# Changelog

## 0.3.0

### Added

- `createVerificationChallenges(postgres, { policies, codeLength? })`, which issues and consumes short codes bound to an actor, an action, and a target, storing only the SHA-256 hashes of the token and the code, in a `verification_challenge` table the README describes. `issue(binding, deliver)` resolves to `issued`, with the token and when it expires, or to `limit`, with a `retryAt`, once the actor reached the action's issue limit within its window; it supersedes the binding's active challenge, and delivers the code after the challenge is committed. `consume(attempt)` resolves to `true` once for the right code, counts a wrong one, and stops accepting codes after the policy's `maxFailedAttempts`. Policies that aren't valid throw `INVALID_VERIFICATION_POLICY`, input that isn't valid throws `INVALID_VERIFICATION_INPUT`, and a delivery that throws makes `issue` throw `VERIFICATION_DELIVERY_FAILED`, with the code and the token redacted.
- `IVerificationAttempt`, `IVerificationBinding`, `IVerificationChallenges`, `IVerificationChallengesOptions`, `IVerificationDeliver`, `IVerificationDelivery`, `IVerificationIssue`, and `IVerificationPolicy`.
- `readDatabaseSummary(executor, { schema? })`, which reads the database's name, the server's version, its size, its active connections out of the server's maximum, and the tables in a schema, and `listTableSizes(executor, { schema? })`, which lists a schema's tables with their total sizes, sorted by name. `diffTables(actual, expected)` gives the expected tables that are missing and the tables that aren't expected.
- `defineCounterTable({ table, keyColumns, counters })`, which builds counter UPSERTs with `buildIncrement` and updates of existing rows with `buildAdjustment`, and `applyCounterQueries(client, queries)`, which runs them in a transaction sorted by row, so concurrent transactions never deadlock on the same rows. A definition that isn't valid throws `INVALID_COUNTER_TABLE`, a key or an amount that isn't valid throws `INVALID_COUNTER_CHANGE`, and an adjustment of a missing row throws `COUNTER_ROW_NOT_FOUND`.
- `IDatabaseSummary`, `IIntrospectionOptions`, `ITableDiff`, `ITableSize`, `ICounterChanges`, `ICounterKey`, `ICounterQuery`, `ICounterTable`, and `ICounterTableDefinition`.
- A recipe that maps verification outcomes to an app's responses.

## 0.2.0

### Added

- `defineTimeoutProfile({ statementTimeoutSeconds, lockTimeoutSeconds, queryGraceSeconds? })`, a frozen profile of how long a kind of work may run, whose client timeout is the statement timeout plus a grace, 15 seconds by default. `toPoolTimeouts(profile)` gives it to `createPostgres`, and `withQueryTimeout(query, profile)` gives one query its client timeout. A profile that isn't valid throws `INVALID_TIMEOUT_PROFILE`.
- `transaction(operation, { timeouts })`, which sets a profile's statement and lock timeouts for that transaction only.
- `createOptionalReader(options)`, which runs optional reads, such as a header's counters, only while the pool has spare clients, shares a running read by its key, gives up after `admissionSeconds`, and never throws. Options that aren't valid throw `INVALID_OPTIONAL_READ_OPTIONS`.
- `admitUsage(postgres, input)`, which admits an actor's action at most `limit` times in a trailing window, and, with a `cooldownSeconds`, once per scope for any actor, recording each admission in a `usage_event` table the README describes. It resolves to `accepted`, `cooldown`, or `limit`, with a `retryAt` when one is known, and concurrent callers can't exceed either rule. Input that isn't valid throws `INVALID_USAGE_ADMISSION`.
- `ITimeoutProfile`, `ITransactionOptions`, `IOptionalRead`, `IOptionalReader`, `IOptionalReaderOptions`, `IUsageAdmission`, and `IUsageAdmissionInput`.
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
