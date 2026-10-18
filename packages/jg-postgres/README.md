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
    lock.assertActive(); // throws SESSION_LOCK_LOST once the lock's connection is gone
    return 'deleted';
  },
);
// { acquired: false } when another request holds the lock
```

### Cursor pages and ordered lists

`listByCursor` lists a page of rows after a cursor, and `buildCursorPage` turns a page listed with one extra row into `{ items, nextCursor }`. `moveUp` and `moveDown` swap a row's sort order with its neighbor's, in their own transaction under the list's lock, and `lockOrderedList` takes the same lock for an append. Every table and column name is quoted.

### Errors

| Code                          | When                                                                |
| ----------------------------- | ------------------------------------------------------------------- |
| `TRANSACTION_OUTCOME_UNKNOWN` | The connection was lost during `COMMIT`                             |
| `SESSION_LOCK_LOST`           | The connection that held a session lock was lost                    |
| `INVALID_IDENTIFIER`          | A name is empty, holds a null character, or is longer than 63 bytes |
| `ROW_NOT_FOUND`               | The row to move doesn't exist in the ordered list                   |
| `ROW_ALREADY_FIRST`           | The row to move up is already first                                 |
| `ROW_ALREADY_LAST`            | The row to move down is already last                                |
| `MOVE_FAILED`                 | The move didn't update exactly two rows                             |

A query's own error, such as a constraint violation, is node-postgres's `DatabaseError`, unchanged.

## Documentation

The full API reference ships in the package as `API.md`, generated from its TSDoc for the installed version, and is at https://jg-packages.jesusgraterol.dev/packages/jg-postgres/.

Recipes for common jobs ship as `RECIPES.md`, with every block typechecked against the release, and are at https://jg-packages.jesusgraterol.dev/packages/jg-postgres/recipes/.

## License

[MIT](https://github.com/jesusgraterol/jg-packages/blob/main/packages/jg-postgres/LICENSE)
