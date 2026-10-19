# jg-postgres recipes

Patterns for PostgreSQL services: wiring pools, turning constraint errors into app errors, paginating, timeouts for slow work, and verification codes.

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

## A slow transaction with its own timeouts

Use this when most queries must fail fast, so a slow one frees its client for other requests, but some work, such as a monthly report, needs longer. Give the pool the short profile, and the slow transaction a profile of its own:

```ts
import {
  createPostgres,
  defineTimeoutProfile,
  toPoolTimeouts,
  withQueryTimeout,
} from 'jg-postgres';

// every request's queries: a slow one fails fast and frees its client
const STANDARD = defineTimeoutProfile({ statementTimeoutSeconds: 15, lockTimeoutSeconds: 5 });

// the monthly report, which reads a lot and may wait longer for the rows it locks
const REPORT = defineTimeoutProfile({ statementTimeoutSeconds: 300, lockTimeoutSeconds: 30 });

const postgres = createPostgres({
  connectionString: process.env['DATABASE_URL'],
  ...toPoolTimeouts(STANDARD),
});

export const buildMonthlyReport = (month: string): Promise<void> =>
  postgres.transaction(
    async (client) => {
      // without withQueryTimeout, the pool's 30-second client timeout would cut these off
      await client.query(
        withQueryTimeout(
          { text: 'DELETE FROM monthly_report WHERE month = $1;', values: [month] },
          REPORT,
        ),
      );
      await client.query(
        withQueryTimeout(
          {
            text: 'INSERT INTO monthly_report (month, revenue) SELECT $1, sum(amount) FROM payment WHERE to_char(paid_at, $2) = $1;',
            values: [month, 'YYYY-MM'],
          },
          REPORT,
        ),
      );
    },
    { timeouts: REPORT },
  );
```

The profile's statement and lock timeouts last only as long as the transaction, so the client goes back to the pool with the pool's own. Each query also needs `withQueryTimeout`, because node-postgres gives every query the pool's `query_timeout`, the statement timeout plus a grace of 15 seconds, unless the query sets its own. When the client stops waiting for a query, the transaction rolls back, and the client goes back to the pool only if `ROLLBACK` confirms the connection in time.

## Answering verification requests

Map each verification outcome to what the app answers, in one place, so every endpoint that issues or checks a code reports a limit, a wrong code, and a failed delivery the same way. The functions don't depend on a framework, so a controller only returns their result:

```ts
import { hasErrorCode } from 'jg-exception';
import {
  createPostgres,
  createVerificationChallenges,
  ERRORS,
  type IVerificationAttempt,
  type IVerificationBinding,
} from 'jg-postgres';

declare const postgres: ReturnType<typeof createPostgres>;
declare const sendEmail: (to: string, text: string, idempotencyKey: string) => Promise<void>;

// what the app answers: an HTTP status, and a code its client shows a message for
type IVerificationResponse =
  | { status: 200; code: 'CODE_SENT'; challengeToken: string; expiresAt: string }
  | { status: 200; code: 'EMAIL_VERIFIED' }
  | { status: 400; code: 'INVALID_CODE' }
  | { status: 429; code: 'TOO_MANY_CODES'; retryAt: string }
  | { status: 503; code: 'CODE_NOT_SENT' };

const challenges = createVerificationChallenges(postgres, {
  policies: {
    'verify-email': {
      validitySeconds: 600,
      maxFailedAttempts: 5,
      issueLimit: 5,
      issueWindowSeconds: 3_600,
    },
  },
});

export const sendEmailCode = async (
  binding: IVerificationBinding,
): Promise<IVerificationResponse> => {
  try {
    const issued = await challenges.issue(binding, ({ code, targetId, challengeId }) =>
      sendEmail(targetId, `Your code is ${code}`, challengeId),
    );
    return issued.outcome === 'issued'
      ? {
          status: 200,
          code: 'CODE_SENT',
          challengeToken: issued.challengeToken,
          expiresAt: issued.expiresAt,
        }
      : { status: 429, code: 'TOO_MANY_CODES', retryAt: issued.retryAt };
  } catch (error) {
    // the code counts toward the limit, so the user waits as for any other code
    if (hasErrorCode(error, ERRORS.VERIFICATION_DELIVERY_FAILED)) {
      return { status: 503, code: 'CODE_NOT_SENT' };
    }
    throw error;
  }
};

export const confirmEmailCode = async (
  attempt: IVerificationAttempt,
): Promise<IVerificationResponse> =>
  (await challenges.consume(attempt))
    ? { status: 200, code: 'EMAIL_VERIFIED' }
    : { status: 400, code: 'INVALID_CODE' };
```

`consume` gives one `false` for a wrong, used, expired, or superseded code, and for another user's token, so `INVALID_CODE` tells an attacker nothing about which. Log the delivery failure before answering: its message names the challenge, with the code and the token redacted.
