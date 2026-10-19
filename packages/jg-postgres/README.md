# jg-postgres

PostgreSQL helpers for node-postgres: safe transactions, advisory locks, SQLSTATE checks, cursor pages, and ordered lists.

## Install

```bash
npm install jg-postgres
```

## Usage

Create one pool per database, with timeouts, and close it at shutdown:

```ts
import { createPostgres } from 'jg-postgres';

const postgres = createPostgres({
  host: 'db.internal',
  database: 'app',
  user: 'app',
  password: 'secret',
  max: 10,
  connectionTimeoutMillis: 30_000, // waiting for a connection
  statement_timeout: 60_000, // one statement, on the server
  lock_timeout: 30_000, // waiting for a row or table lock
  idle_in_transaction_session_timeout: 300_000, // a transaction left open
  onError: (error) => console.error('PostgreSQL', error),
});

const users = await postgres.query<{ id: string }>('SELECT id FROM user_account LIMIT $1;', [10]);
await postgres.close();
```

The pool reads `NUMERIC` as a number and `TIMESTAMPTZ` as an ISO 8601 UTC string, such as `'2026-10-17T08:30:00.000Z'`, and keeps `BIGINT` as a string, so no digit of a large amount is lost. The parsers are set on the pool, not node-postgres's global registry, so other pools in the program keep theirs. Errors no caller awaits, such as an idle connection the server closed, go to `onError`, `console.error` by default, instead of crashing the process.

### Transactions

```ts
import { createPostgres } from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;

const orderId = await postgres.transaction(async (client) => {
  const { rows } = await client.query<{ id: string }>(
    'INSERT INTO purchase_order (user_account_id) VALUES ($1) RETURNING id;',
    ['42'],
  );
  await client.query('UPDATE user_account SET order_count = order_count + 1 WHERE id = $1;', [
    '42',
  ]);
  return rows[0]?.id;
});
```

`transaction` commits when the operation resolves, rolls back when it throws, and rejects with the operation's own error. It always returns its client to the pool, or destroys it when its state is unknown. When the connection breaks during `COMMIT`, nobody can tell whether the transaction committed, so it rejects with `TRANSACTION_OUTCOME_UNKNOWN`: check the data before retrying anything that isn't idempotent. Run work inside a transaction on its `client`, and never start a transaction inside another.

### Transactions on a client you already hold

`runTransaction` runs the same kind of transaction on a client you checked out yourself, so several transactions can run one after another on one connection. It never releases the client: release it with `client.release(isInTransaction(client))`, which destroys a client whose transaction ended in an unknown state instead of returning it to the pool:

```ts
import { createPostgres, isInTransaction, runTransaction } from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;

const client = await postgres.pool.connect();
try {
  await runTransaction(client, async (transactionClient) => {
    await transactionClient.query('DELETE FROM user_session WHERE user_account_id = $1;', ['42']);
  });
  await runTransaction(client, async (transactionClient) => {
    await transactionClient.query('DELETE FROM user_account WHERE id = $1;', ['42']);
  });
} finally {
  client.release(isInTransaction(client));
}
```

`isInTransaction` is true while a transaction `runTransaction` began is open, and stays true when its end is unknown: a `COMMIT` the server never answered, which rejects with `TRANSACTION_OUTCOME_UNKNOWN`, or a `ROLLBACK` that failed, which goes to `onError`, `console.error` by default. A client already in a transaction, whether `runTransaction`'s or one the caller began with its own `BEGIN`, is refused with `TRANSACTION_ALREADY_ACTIVE` before any query, so a transaction is never nested inside another. `runTransaction` takes the same `timeouts` as `transaction`. It tracks only the clients of the copy of jg-postgres that ran it, and a `postgres.transaction()` started inside its operation runs on another client.

### Timeouts

A profile says how long a kind of work may run: a statement on the server, a wait for a lock, and the client's wait for the answer, which adds a grace, 15 seconds by default, so the server's own error arrives first. Give the pool the profile of everyday work, and a slow transaction one of its own:

```ts
import {
  createPostgres,
  defineTimeoutProfile,
  toPoolTimeouts,
  withQueryTimeout,
} from 'jg-postgres';

const STANDARD = defineTimeoutProfile({ statementTimeoutSeconds: 15, lockTimeoutSeconds: 5 });
const REPORT = defineTimeoutProfile({ statementTimeoutSeconds: 300, lockTimeoutSeconds: 30 });

const postgres = createPostgres({ connectionString, ...toPoolTimeouts(STANDARD) });

await postgres.transaction(
  (client) =>
    client.query(withQueryTimeout({ text: 'SELECT build_report($1);', values: [month] }, REPORT)),
  { timeouts: REPORT },
);
```

`timeouts` sets the statement and lock timeouts for that transaction only, so the client goes back to the pool with the pool's. The pool's `query_timeout` still applies to each query that doesn't set its own, so pass the transaction's queries through `withQueryTimeout` with the same profile. A query the client stops waiting for is rolled back: the client goes back to the pool once `ROLLBACK`, which has the pool's `query_timeout` too, confirms the connection, and is destroyed otherwise.

### Optional reads

`createOptionalReader` runs reads that are nice to have, such as a counter in a page's header, without ever delaying or crowding out essential work. A read is skipped, giving `null` at once, when the reader already runs `maxActiveReads` reads, a request waits for a client, or the pool can't give more clients than `reservedIdleClients`, counting idle ones and the room left to open new ones. It runs in a read-only transaction with short timeouts, gives `null` after `admissionSeconds`, and never throws:

```ts
import { createOptionalReader } from 'jg-postgres';

const counters = createOptionalReader({ postgres }); // 2 reads at most, 2 clients left free, 1 second

const unread = counters.read(
  `unread:${accountId}`, // callers of the same key share one read
  {
    text: 'SELECT count(*)::int AS count FROM notification WHERE account_id = $1;',
    values: [accountId],
  },
  (row) => (row as { count: number }).count,
);
const count = await unread.completion; // a number, or null
```

### Deleting expired rows

`deleteExpiredInBatches` deletes a table's rows older than a cutoff, such as audit events past their retention, a batch at a time, so no statement holds many locks or runs long:

```ts
import { deleteExpiredInBatches } from 'jg-postgres';

const { deletedCount, cutoff } = await deleteExpiredInBatches(postgres, {
  table: 'audit_event',
  timestampColumn: 'created_at', // the default
  keyColumn: 'id', // the default
  olderThan: { months: 6 }, // or cutoff: a Date or an ISO string
  batchSize: 1_024, // the default, at most 8,192
  filters: [{ column: 'tenant_id', value: tenantId }], // optional
});
```

`olderThan` takes months and days, subtracted on the UTC calendar, so six months before August 31 is the last day of February, and then seconds. It's counted once from the database's clock, and a row exactly at the cutoff is kept. Each batch is one statement that locks the oldest expired rows, skipping rows another transaction holds, which the next run deletes, and deletes them by `keyColumn`; batches repeat until one deletes nothing, so concurrent runs share the work without deleting a row twice. With `timeouts`, a profile from `defineTimeoutProfile`, each batch runs as a transaction of its own with them. Every name is quoted.

`keyColumn` must be unique and not null, such as the primary key: a key shared by an expired and an unexpired row would delete both. Index the timestamp and the key together, such as `CREATE INDEX idx_ae__created_at_id ON audit_event (created_at, id);`, so each batch reads only the rows it deletes.

### Usage limits

`admitUsage` decides, atomically, whether an actor may do a rate-limited action now, such as sending an invitation, and records it when they may. It refuses with `cooldown` while the same action on the same scope was accepted less than `cooldownSeconds` ago, by any actor, and with `limit` once the actor did the action `limit` times within `windowSeconds`:

```ts
import { admitUsage } from 'jg-postgres';

const admission = await admitUsage(postgres, {
  actorId: userId,
  actionId: 'send-invitation',
  scopeKey: inviteeEmailHash, // the cooldown applies per invitee
  limit: 20,
  windowSeconds: 86_400,
  cooldownSeconds: 60,
});
// { outcome: 'accepted' | 'cooldown' | 'limit', retryAt: an ISO timestamp, or null }
```

Concurrent calls queue on transaction advisory locks, the scope's then the actor's, so two can never both pass, and every comparison uses the database's clock. The accepted actions go in a `usage_event` table:

```sql
CREATE TABLE usage_event (
  id bigint GENERATED ALWAYS AS IDENTITY,
  actor_id varchar(256) NOT NULL,
  action_id varchar(128) NOT NULL,
  scope_key varchar(256) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_ue__id PRIMARY KEY (id),
  CONSTRAINT chk_ue__actor_id_non_empty CHECK (actor_id <> ''),
  CONSTRAINT chk_ue__action_id_non_empty CHECK (action_id <> ''),
  CONSTRAINT chk_ue__scope_key_non_empty CHECK (scope_key <> '')
);
CREATE INDEX idx_ue__actor_id_action_id_created_at ON usage_event (actor_id, action_id, created_at);
CREATE INDEX idx_ue__action_id_scope_key_created_at_scoped
  ON usage_event (action_id, scope_key, created_at)
  WHERE scope_key IS NOT NULL;
CREATE INDEX idx_ue__created_at ON usage_event (created_at);
```

The table grows with every accepted action. Prune it on a schedule with [`deleteExpiredInBatches`](#deleting-expired-rows), deleting the rows older than the longest window or cooldown of any action:

```ts
import { deleteExpiredInBatches } from 'jg-postgres';

await deleteExpiredInBatches(postgres, { table: 'usage_event', olderThan: { seconds: 86_400 } });
```

### Verification challenges

`createVerificationChallenges` issues and checks short codes bound to an actor, an action, and a target, such as the code that confirms a new email address. Each action has a policy: how long a code is valid, how many wrong codes it takes, how many codes an actor may be issued within a window, over every target, and how often a challenge's code may be resent:

```ts
import { createVerificationChallenges } from 'jg-postgres';

const challenges = createVerificationChallenges(postgres, {
  policies: {
    'verify-email': {
      validitySeconds: 600,
      maxFailedAttempts: 5,
      issueLimit: 5,
      issueWindowSeconds: 3_600,
      resendLimit: 3, // optional: without it, resend refuses the action
      resendCooldownSeconds: 60, // optional
    },
  },
  codeLength: 6, // the default
});

const binding = { actorId: userId, actionId: 'verify-email', targetId: newEmail };
const issued = await challenges.issue(binding, ({ code, deliveryId }) =>
  mailer.send(newEmail, code, { idempotencyKey: deliveryId }),
);
// { outcome: 'issued', challengeToken, expiresAt } or { outcome: 'limit', retryAt }

// when the user asks for another code, with the token the client kept
const resent = await challenges.resend(
  { ...binding, challengeToken: savedToken },
  ({ code, deliveryId, remainingSeconds }) =>
    mailer.send(newEmail, code, { idempotencyKey: deliveryId, remainingSeconds }),
);
// { outcome: 'resent', expiresAt }, { outcome: 'cooldown', retryAt }, { outcome: 'limit' },
// or { outcome: 'invalid' }

// later, with the token the client kept and the code the user typed
const isVerified = await challenges.consume({
  ...binding,
  challengeToken: savedToken,
  code: typedCode,
});
```

`issue` refuses with `limit` once the actor was issued `issueLimit` codes within the window, with `retryAt`, when the oldest of them leaves it. Otherwise it supersedes the binding's active challenge and commits the new one, then calls `deliver` with the code, the only time it's available. A delivery that throws makes `issue` throw `VERIFICATION_DELIVERY_FAILED`, with the code and the token redacted from it and its cause; the challenge still counts toward the limit. Concurrent issues for an actor and an action queue on a transaction advisory lock, and every comparison uses the database's clock.

`resend` sends the binding's active challenge a new code, under the same token and the same expiry, so the earlier code stops working. Wrong codes keep counting toward `maxFailedAttempts`, and resends never count toward `issueLimit`. It refuses with `limit` once the challenge was resent `resendLimit` times, and with `cooldown` and a `retryAt` until `resendCooldownSeconds` passed since its issue or its last resend; a policy without `resendLimit` makes `resend` throw `INVALID_VERIFICATION_INPUT`. A challenge that's used, superseded, expired, or out of attempts, another binding's token, or a token of the wrong shape resolves to `invalid`. Concurrent resends of one challenge queue on its row, so they can't exceed the limit. The new code is delivered once it's committed; a delivery that throws makes `resend` throw `VERIFICATION_DELIVERY_FAILED`, redacted as for `issue`, and the resend still counts, with the earlier code already stopped. A resend can go out with little time left, so `remainingSeconds` lets the message say how long the code works.

Every delivery has a `deliveryId`, `${challengeId}:0` for the issue and `${challengeId}:1` and up for each resend. Use it, not `challengeId`, as the email's idempotency key: it's the same for every attempt to send one code, and different for each new code.

`consume` resolves to `true` once, for the right code. A wrong code counts a failed attempt, and a challenge stops accepting codes after `maxFailedAttempts` of them, so the policy's current value applies. A used, superseded, or expired challenge, another binding's token, or a token or code of the wrong shape resolves to `false` without counting, and every `false` looks the same to the caller.

Only the SHA-256 hashes of the token and of the code, combined with its token, are stored, in a `verification_challenge` table:

```sql
CREATE TABLE verification_challenge (
  id bigint GENERATED ALWAYS AS IDENTITY,
  actor_id varchar(256) NOT NULL,
  action_id varchar(128) NOT NULL,
  target_id varchar(256) NOT NULL,
  token_hash text NOT NULL,
  code_hash text NOT NULL,
  failed_attempt_count smallint NOT NULL DEFAULT 0,
  resend_count smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  superseded_at timestamptz NULL,
  resent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_vc__id PRIMARY KEY (id),
  CONSTRAINT uq_vc__token_hash UNIQUE (token_hash),
  CONSTRAINT chk_vc__actor_id_non_empty CHECK (actor_id <> ''),
  CONSTRAINT chk_vc__action_id_non_empty CHECK (action_id <> ''),
  CONSTRAINT chk_vc__target_id_non_empty CHECK (target_id <> ''),
  CONSTRAINT chk_vc__token_hash_sha256 CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_vc__code_hash_sha256 CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_vc__failed_attempt_count_non_negative CHECK (failed_attempt_count >= 0),
  CONSTRAINT chk_vc__resend_count_non_negative CHECK (resend_count >= 0),
  CONSTRAINT chk_vc__expires_at_chronological CHECK (expires_at > created_at),
  CONSTRAINT chk_vc__resent_at_chronological CHECK (resent_at IS NULL OR resent_at >= created_at),
  CONSTRAINT chk_vc__used_at_superseded_at_mutually_exclusive
    CHECK (used_at IS NULL OR superseded_at IS NULL)
);
CREATE UNIQUE INDEX uidx_vc__actor_id_action_id_target_id_active
  ON verification_challenge (actor_id, action_id, target_id)
  WHERE used_at IS NULL AND superseded_at IS NULL;
CREATE INDEX idx_vc__actor_id_action_id_created_at
  ON verification_challenge (actor_id, action_id, created_at);
CREATE INDEX idx_vc__created_at ON verification_challenge (created_at);
```

Prune it on a schedule with [`deleteExpiredInBatches`](#deleting-expired-rows), deleting the rows older than the longest `validitySeconds` or `issueWindowSeconds` of any policy. A younger row may still be consumed, or count toward a limit:

```ts
import { deleteExpiredInBatches } from 'jg-postgres';

await deleteExpiredInBatches(postgres, {
  table: 'verification_challenge',
  olderThan: { seconds: 3_600 },
});
```

A table created from jg-postgres 0.3.0's README lacks the two columns `resend` uses. `issue` and `consume` keep working without them, but add them before deploying code that calls `resend`. Both are filled for every existing row, `0` and `NULL`, so the checks hold:

```sql
ALTER TABLE verification_challenge
  ADD COLUMN resend_count smallint NOT NULL DEFAULT 0,
  ADD COLUMN resent_at timestamptz NULL,
  ADD CONSTRAINT chk_vc__resend_count_non_negative CHECK (resend_count >= 0),
  ADD CONSTRAINT chk_vc__resent_at_chronological
    CHECK (resent_at IS NULL OR resent_at >= created_at);
```

### Error log

`jg-postgres/error-log`'s `createErrorLog` records errors in a table, such as the ones an API's exception filter catches, for an admin page to list. It never rejects, so recording an error can't fail the request that hit it:

```ts
import { createErrorLog } from 'jg-postgres/error-log';

const errorLog = createErrorLog(postgres, {
  origin: 'api', // what reports the errors: 1 to 256 characters
  table: 'error_log', // the default
  redactKeys: ['password', 'token'], // replaced in an Exception's data, at any depth, any case
  maxMessageLength: 8_192, // the default, the column's size
  maxPayloadBytes: 1_024, // the default
  maxBatchSize: 256, // the default: the rows each INSERT writes
  onRecorded: ({ count }) => unreadErrors.increment(count), // optional, not awaited
});

await errorLog.record({ error, userInfo: { userId } }); // true when a row was inserted

// one row per origin and key, however often the failure repeats
await errorLog.recordMany(
  failures.map((failure) => ({ error: failure.error, deduplicationKey: failure.jobId })),
);
```

A row's `error` is the error's message, prefixed with its code, such as `NOT_FOUND: The user doesn't exist.`, without null characters, and cut to `maxMessageLength` characters, ending in ` [truncated]`. An `Exception`'s data, when it's an object, is its `payload`, with `redactKeys` replaced, cycles left out, and null characters removed; data larger than `maxPayloadBytes` as JSON is left out of that row alone. `userInfo` is stored as given, without its undefined fields. An entry's own `origin` overrides the log's, and an origin that isn't 1 to 256 characters falls back to it.

A `deduplicationKey` is stored as its SHA-256 digest in lowercase hex, the same digest as Node.js's `createHash('sha256').update(key).digest('hex')`, and the table keeps one row per origin and digest: a repeat inserts nothing and resolves to `false`, or counts 0. An app moving digests it computed itself onto the log passes the strings it hashed, not the digests, so its stored rows keep their identity. Without a key, every record inserts a row.

A write runs in one transaction with `timeouts`, 5 seconds per statement and 1 second for a lock by default, so a table another transaction locks stops it quickly. A write that fails, for a lock, a constraint, or a missing table, inserts nothing and goes to the database's `onError` as `ERROR_LOG_WRITE_FAILED`, with its SQLSTATE and its entry count but without the rows or the database's message, which can quote them; `record` then resolves to `false` and `recordMany` to `0`. `onRecorded` runs after a write that inserted rows commits; what it throws or rejects with goes to `onError` too.

The app creates the table, under any name it passes as `table`:

```sql
CREATE TABLE error_log (
  id bigint GENERATED ALWAYS AS IDENTITY,
  origin varchar(256) NOT NULL,
  error varchar(8192) NOT NULL,
  user_info jsonb NULL,
  payload jsonb NULL,
  deduplication_hash char(64) NULL,
  event_time timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_el__id PRIMARY KEY (id),
  CONSTRAINT chk_el__origin_non_empty CHECK (origin <> ''),
  CONSTRAINT chk_el__error_non_empty CHECK (error <> ''),
  CONSTRAINT chk_el__user_info_object
    CHECK (user_info IS NULL OR jsonb_typeof(user_info) = 'object'),
  CONSTRAINT chk_el__payload_object CHECK (payload IS NULL OR jsonb_typeof(payload) = 'object'),
  CONSTRAINT chk_el__deduplication_hash_sha256
    CHECK (deduplication_hash IS NULL OR deduplication_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT uq_el__origin_deduplication_hash UNIQUE (origin, deduplication_hash)
);
CREATE INDEX idx_el__origin_id_desc ON error_log (origin, id DESC);
CREATE INDEX idx_el__event_time ON error_log (event_time);
```

List it for an admin page with `listByCursor`, newest first, and prune it with `deleteExpiredInBatches`:

```ts
import { deleteExpiredInBatches, listByCursor } from 'jg-postgres';

const rows = await listByCursor(postgres.pool, {
  table: 'error_log',
  columns: ['id', 'origin', 'error', 'event_time'],
  filters: [{ column: 'origin', value: 'api' }],
  after: cursor,
  limit: 51,
});

await deleteExpiredInBatches(postgres, {
  table: 'error_log',
  timestampColumn: 'event_time',
  olderThan: { days: 90 },
});
```

### Database summaries

`readDatabaseSummary` and `listTableSizes` read what an admin dashboard or a health check shows about the database, and `diffTables` compares the tables with the ones a migration should have created:

```ts
import { diffTables, listTableSizes, readDatabaseSummary } from 'jg-postgres';

const summary = await readDatabaseSummary(postgres.pool); // the public schema, or { schema }
// { name, serverVersion, serverVersionNumber, sizeBytes, activeConnections, maxConnections, tableCount }

const tables = await listTableSizes(postgres.pool); // [{ name, totalBytes }], sorted by name
const { missing, unexpected } = diffTables(
  tables.map(({ name }) => name),
  ['app_user', 'session'],
);
```

Sizes and counts are numbers, and sizes include indexes and TOAST data. `activeConnections` counts the connections to this database running a query. Without the `pg_read_all_stats` role, PostgreSQL shows a role only its own connections, so the count is lower than the server's.

### Counter tables

`defineCounterTable` builds the queries that change counter rows, such as an account's daily usage or a balance, quoting every name once and sending every value as a parameter. `applyCounterQueries` runs them in the caller's transaction, sorted by row, so two transactions that change the same rows lock them in the same order and never deadlock:

```ts
import { applyCounterQueries, defineCounterTable } from 'jg-postgres';

const dailyUsage = defineCounterTable({
  table: 'daily_usage',
  keyColumns: ['account_id', 'day'],
  counters: ['request_count', 'token_count'],
});

await postgres.transaction((client) =>
  applyCounterQueries(client, [
    // inserts the row, or adds to it
    dailyUsage.buildIncrement(
      { account_id: accountId, day },
      { request_count: 1, token_count: tokens },
    ),
    // adds to a row that must exist, or throws COUNTER_ROW_NOT_FOUND
    dailyUsage.buildAdjustment({ account_id: accountId, day }, { token_count: -refunded }),
  ]),
);
```

An increment is an `INSERT … ON CONFLICT (key columns) DO UPDATE`, so the table needs a unique constraint on exactly the key columns, and a default, such as 0, for every counter. Amounts are whole numbers or bigints within `BIGINT`: positive to increment, and non-zero to adjust. A counter that would leave `BIGINT`'s range fails with SQLSTATE 22003, which `isNumericValueOutOfRangeError` checks, and the transaction rolls back.

### Constraint errors

```ts
import { isUniqueViolationError } from 'jg-postgres';

declare const error: unknown;

if (isUniqueViolationError(error, 'uq_user_account__email')) {
  // the email is already registered
}
```

`isDatabaseError` and the checks for unique, foreign key, not-null, check, and restrict violations, string truncation, numeric overflow, invalid text, serialization failures, deadlocks, and canceled queries read the SQLSTATE code. The constraint checks take an optional constraint name.

### Advisory locks

`createAdvisoryLockKey` turns a name into the 64-bit key PostgreSQL's advisory locks take. `lockTransaction` holds one until the transaction ends, waiting while another holds it. `withSessionLock` holds one on a connection across several transactions, or skips the work when another session holds it:

```ts
import { createAdvisoryLockKey, createPostgres, withSessionLock } from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;

const outcome = await withSessionLock(
  postgres,
  createAdvisoryLockKey('user-account-deletion:42'),
  async (lock) => {
    await lock.transaction(async (client) => {
      await client.query('DELETE FROM user_session WHERE user_account_id = $1;', ['42']);
    });
    lock.assertActive(); // throws SESSION_LOCK_LOST once the lock's connection is gone
    await lock.transaction(async (client) => {
      await client.query('DELETE FROM user_account WHERE id = $1;', ['42']);
    });
    return 'deleted';
  },
);
// { acquired: false } when another request holds the lock
```

`lock.transaction` runs a transaction on the lock's client with `runTransaction`, after checking the lock is still held, and takes the same `timeouts`. Once the operation ends, the lock is released and its client returned to the pool, unless a transaction on it is still open, such as one the operation began with its own `BEGIN`, or ended in an unknown state: then the client is destroyed, which closes its connection and releases the lock with it.

### Cursor pages and ordered lists

`listByCursor` lists a page of rows after a cursor, and `buildCursorPage` turns a page listed with one extra row into `{ items, nextCursor }`. `moveUp` and `moveDown` swap a row's sort order with its neighbor's, in their own transaction under the list's lock, and `lockOrderedList` takes the same lock for an append. Every table and column name is quoted.

### A record store

`jg-postgres/record-store` keeps small JSON records, such as counters or a feature's settings, one row each in a `record_store` table, which the app creates:

```sql
CREATE TABLE IF NOT EXISTS record_store (
  id    varchar(512),
  value jsonb        NOT NULL,

  CONSTRAINT pk_rs__id PRIMARY KEY (id),
  CONSTRAINT chk_rs__id_non_empty CHECK (id <> ''),
  CONSTRAINT chk_rs__value_object CHECK (jsonb_typeof(value) = 'object')
);
```

```ts
import { createPostgres } from 'jg-postgres';
import { createRecordStore } from 'jg-postgres/record-store';
import { z } from 'zod';

declare const postgres: ReturnType<typeof createPostgres>;

const counters = createRecordStore({
  postgres,
  id: 'admin:unread-counts',
  defaults: { notifications: 0, reports: 0 },
  schema: z.object({ notifications: z.number(), reports: z.number() }),
});

await counters.incrementNumber('notifications', 1); // atomic, so concurrent increments all count
await counters.setNumber('reports', 0); // leaves the other fields as they are
await counters.get(); // { notifications: 1, reports: 0 }, checked with the schema
```

The defaults fill every missing or null field when the record is read, and are the only keys a write keeps. Every method takes an optional transaction's client, to run in that transaction without committing it.

### Errors

| Code                            | When                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TRANSACTION_OUTCOME_UNKNOWN`   | The connection was lost during `COMMIT`                                                                                                                                       |
| `TRANSACTION_ALREADY_ACTIVE`    | `runTransaction` or a lock's `transaction` was given a client that's already in a transaction                                                                                 |
| `SESSION_LOCK_LOST`             | The connection that held a session lock was lost                                                                                                                              |
| `INVALID_IDENTIFIER`            | A name is empty, holds a null character, or is longer than 63 bytes                                                                                                           |
| `ROW_NOT_FOUND`                 | The row to move doesn't exist in the ordered list                                                                                                                             |
| `ROW_ALREADY_FIRST`             | The row to move up is already first                                                                                                                                           |
| `ROW_ALREADY_LAST`              | The row to move down is already last                                                                                                                                          |
| `MOVE_FAILED`                   | The move didn't update exactly two rows                                                                                                                                       |
| `INVALID_EXPIRED_DELETION`      | `deleteExpiredInBatches` was given both `olderThan` and `cutoff` or neither, an age or a date that isn't valid, a batch size outside 1 to 8,192, or a filter without a column |
| `INVALID_TIMEOUT_PROFILE`       | A timeout profile's seconds aren't positive and finite, or its lock timeout is longer than its statement timeout                                                              |
| `INVALID_OPTIONAL_READ_OPTIONS` | An optional reader's database, limits, or timeouts aren't valid                                                                                                               |
| `INVALID_USAGE_ADMISSION`       | A usage admission's ids, limit, or seconds aren't valid, or it has a cooldown without a scope                                                                                 |
| `INVALID_VERIFICATION_POLICY`   | The verification policies or the code length aren't valid                                                                                                                     |
| `INVALID_VERIFICATION_INPUT`    | A verification binding's ids aren't valid, its action has no policy, issue or resend has no delivery function, or resend's policy has no resend limit                         |
| `VERIFICATION_DELIVERY_FAILED`  | The delivery function threw, after the challenge or its resend was committed                                                                                                  |
| `INVALID_COUNTER_TABLE`         | A counter table has no key column or no counter, or repeats a name                                                                                                            |
| `INVALID_COUNTER_CHANGE`        | A counter row's key doesn't have exactly the key columns, or an amount isn't a whole, non-zero amount within `BIGINT`                                                         |
| `COUNTER_ROW_NOT_FOUND`         | A counter query changed no row, because the row to adjust doesn't exist                                                                                                       |
| `INVALID_ERROR_LOG_OPTIONS`     | An error log's origin, redact keys, limits, or onRecorded aren't valid                                                                                                        |
| `ERROR_LOG_WRITE_FAILED`        | An error log's write failed, so nothing was inserted; it's reported to `onError`, never thrown                                                                                |

A query's own error, such as a constraint violation, is node-postgres's `DatabaseError`, unchanged.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-postgres/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-postgres/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-postgres/LICENSE)
