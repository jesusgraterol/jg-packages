# jg-postgres recipes

Patterns for services that keep their data in PostgreSQL: wiring the pools into an app, turning constraint errors into app errors, and paginating a list.

## A NestJS module with two databases

Create each pool once, provide it under its own token, and close both when the app shuts down. A pool connects lazily, so creating it at import time opens nothing:

```ts
import { Module, type OnApplicationShutdown } from '@nestjs/common';
import { createEnvironmentReader } from 'jg-env';
import { createPostgres } from 'jg-postgres';

const { readInteger, readString } = createEnvironmentReader(process.env);

// the tokens services inject the databases with, as @Inject(PRIMARY_DATABASE)
export const PRIMARY_DATABASE = Symbol('PRIMARY_DATABASE');
export const SECONDARY_DATABASE = Symbol('SECONDARY_DATABASE');

// the timeouts every pool uses
const TIMEOUTS = {
  connectionTimeoutMillis: 30_000,
  statement_timeout: 60_000,
  lock_timeout: 30_000,
  idle_in_transaction_session_timeout: 300_000,
};

const primary = createPostgres({
  host: readString('PRIMARY_POSTGRES_HOST'),
  port: readInteger('PRIMARY_POSTGRES_PORT'),
  database: readString('PRIMARY_POSTGRES_DB'),
  user: readString('PRIMARY_POSTGRES_USER'),
  password: readString('PRIMARY_POSTGRES_PASSWORD'),
  max: 20,
  ...TIMEOUTS,
});
const secondary = createPostgres({
  host: readString('SECONDARY_POSTGRES_HOST'),
  port: readInteger('SECONDARY_POSTGRES_PORT'),
  database: readString('SECONDARY_POSTGRES_DB'),
  user: readString('SECONDARY_POSTGRES_USER'),
  password: readString('SECONDARY_POSTGRES_PASSWORD'),
  max: 5,
  ...TIMEOUTS,
});

@Module({
  providers: [
    { provide: PRIMARY_DATABASE, useValue: primary },
    { provide: SECONDARY_DATABASE, useValue: secondary },
  ],
  exports: [PRIMARY_DATABASE, SECONDARY_DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await Promise.all([primary.close(), secondary.close()]);
  }
}
```

Enable Nest's shutdown hooks, with `app.enableShutdownHooks()`, so the pools close when the process gets `SIGTERM`.

## Turning a constraint error into an app error

Let the database enforce uniqueness, and translate its error for the client, rather than checking first and racing another request:

```ts
import { Exception } from 'jg-exception';
import { createPostgres, isUniqueViolationError } from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;

export const registerEmail = async (userAccountId: string, email: string): Promise<void> => {
  try {
    await postgres.query('UPDATE user_account SET email = $1 WHERE id = $2;', [
      email,
      userAccountId,
    ]);
  } catch (error) {
    if (isUniqueViolationError(error, 'uq_user_account__email')) {
      throw new Exception('The email is already registered.', { code: 'EMAIL_TAKEN' });
    }
    throw error;
  }
};
```

Naming the constraint keeps another unique column's violation, such as a phone number's, from reading as a taken email.

## A paginated list

List one more row than the page holds, so the page knows whether another follows without counting the table:

```ts
import { buildCursorPage, createPostgres, listByCursor, type ICursorPage } from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;

type IApiError = { id: string; origin: string; event_time: string };

export const listApiErrors = async (
  origin: string | undefined,
  after: string | undefined,
  pageSize = 20,
): Promise<ICursorPage<IApiError>> => {
  const rows = await listByCursor<IApiError>(postgres.pool, {
    table: 'api_error',
    columns: ['id', 'origin', 'event_time'],
    filters: origin === undefined ? [] : [{ column: 'origin', value: origin }],
    after,
    limit: pageSize + 1,
  });
  return buildCursorPage(rows, pageSize, ({ id }) => id);
};
```

The rows come newest first, by an ascending `id`. Pass the page's `nextCursor` as `after` for the next page, and stop when it's `null`.
