import type { QueryConfig } from 'pg';

import { Exception } from 'jg-exception';

import { ERRORS } from '../shared/index.js';

import type { ITimeoutProfile } from './types.js';

// the seconds the client waits past the statement timeout for the server's own error, by default
const DEFAULT_QUERY_GRACE_SECONDS = 15;

/**
 * Checks whether a value is a positive, finite number of seconds.
 * @param value The value.
 * @returns Whether it is.
 */
const isPositiveSeconds = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * Converts seconds to whole milliseconds, as PostgreSQL's settings and the client's timers take
 * them: to the nearest millisecond, and at least 1.
 * @param seconds The seconds.
 * @returns The milliseconds.
 */
const toMilliseconds = (seconds: number): number => Math.max(1, Math.round(seconds * 1000));

/**
 * Ensures a timeout profile holds positive, finite seconds, with the lock timeout no longer than
 * the statement timeout.
 * @param profile The profile.
 * @throws
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 */
export const assertTimeoutProfile = (profile: ITimeoutProfile): void => {
  // a caller that skips type checking may pass no profile at all
  const candidate: Partial<ITimeoutProfile> | null | undefined = profile;
  const statementTimeoutSeconds = candidate?.statementTimeoutSeconds;
  const lockTimeoutSeconds = candidate?.lockTimeoutSeconds;
  if (
    !isPositiveSeconds(statementTimeoutSeconds) ||
    !isPositiveSeconds(lockTimeoutSeconds) ||
    !isPositiveSeconds(candidate?.queryTimeoutSeconds) ||
    lockTimeoutSeconds > statementTimeoutSeconds
  ) {
    throw new Exception(
      'The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.',
      { code: ERRORS.INVALID_TIMEOUT_PROFILE },
    );
  }
};

/**
 * Defines how long a kind of work may run: a statement on the server, a wait for a lock, and the
 * client's wait for the server's answer, which is the statement timeout plus a grace, so the
 * server's own timeout error arrives first. A slow report and an interactive request each get one.
 * @param options The statement and lock timeouts, and the client's grace, 15 seconds by default,
 * all in seconds.
 * @returns The profile, frozen.
 * @example
 * import { defineTimeoutProfile } from 'jg-postgres';
 *
 * const REPORT_TIMEOUTS = defineTimeoutProfile({ statementTimeoutSeconds: 120, lockTimeoutSeconds: 10 });
 * REPORT_TIMEOUTS.queryTimeoutSeconds; // 135
 * @throws
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 */
export const defineTimeoutProfile = ({
  statementTimeoutSeconds,
  lockTimeoutSeconds,
  queryGraceSeconds = DEFAULT_QUERY_GRACE_SECONDS,
}: {
  statementTimeoutSeconds: number;
  lockTimeoutSeconds: number;
  queryGraceSeconds?: number | undefined;
}): ITimeoutProfile => {
  // a grace that isn't positive seconds makes the client timeout invalid, which the check rejects
  const profile = Object.freeze({
    statementTimeoutSeconds,
    lockTimeoutSeconds,
    queryTimeoutSeconds: isPositiveSeconds(queryGraceSeconds)
      ? statementTimeoutSeconds + queryGraceSeconds
      : Number.NaN,
  });
  assertTimeoutProfile(profile);
  return profile;
};

/**
 * Gives a profile's timeouts as createPostgres takes them, in milliseconds, for a pool whose every
 * query follows the profile.
 * @param profile The profile.
 * @returns The pool's `statement_timeout`, `lock_timeout`, and `query_timeout`.
 * @example
 * import { createPostgres, defineTimeoutProfile, toPoolTimeouts } from 'jg-postgres';
 *
 * const STANDARD = defineTimeoutProfile({ statementTimeoutSeconds: 30, lockTimeoutSeconds: 5 });
 * const postgres = createPostgres({ connectionString: process.env['DATABASE_URL'], ...toPoolTimeouts(STANDARD) });
 * @throws
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 */
export const toPoolTimeouts = (
  profile: ITimeoutProfile,
): { statement_timeout: number; lock_timeout: number; query_timeout: number } => {
  assertTimeoutProfile(profile);
  return {
    statement_timeout: toMilliseconds(profile.statementTimeoutSeconds),
    lock_timeout: toMilliseconds(profile.lockTimeoutSeconds),
    query_timeout: toMilliseconds(profile.queryTimeoutSeconds),
  };
};

/**
 * Gives a query the client timeout of a profile, which node-postgres's pool otherwise sets for
 * every query, so a query in a transaction with longer timeouts isn't cut off by the pool's.
 * @param query The query's text and values.
 * @param profile The profile.
 * @returns The query, as node-postgres's query methods take it.
 * @example
 * import { createPostgres, defineTimeoutProfile, withQueryTimeout } from 'jg-postgres';
 *
 * declare const postgres: ReturnType<typeof createPostgres>;
 *
 * const REPORT_TIMEOUTS = defineTimeoutProfile({ statementTimeoutSeconds: 120, lockTimeoutSeconds: 10 });
 * await postgres.transaction(
 *   (client) =>
 *     client.query(withQueryTimeout({ text: 'SELECT build_report($1);', values: [2026] }, REPORT_TIMEOUTS)),
 *   { timeouts: REPORT_TIMEOUTS },
 * );
 * @throws
 * - INVALID_TIMEOUT_PROFILE: The timeout profile needs positive, finite seconds, with the lock timeout no longer than the statement timeout.
 */
export const withQueryTimeout = (
  query: { text: string; values?: unknown[] | undefined },
  profile: ITimeoutProfile,
): QueryConfig & { query_timeout: number } => {
  assertTimeoutProfile(profile);
  return {
    text: query.text,
    ...(query.values === undefined ? {} : { values: query.values }),
    query_timeout: toMilliseconds(profile.queryTimeoutSeconds),
  };
};

/**
 * Builds the query that sets a profile's statement and lock timeouts for the rest of the
 * transaction it runs in.
 * @param profile The profile.
 * @returns The query's text and values.
 */
export const buildTransactionTimeoutsQuery = (
  profile: ITimeoutProfile,
): { text: string; values: string[] } => ({
  text: "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true);",
  values: [
    String(toMilliseconds(profile.statementTimeoutSeconds)),
    String(toMilliseconds(profile.lockTimeoutSeconds)),
  ],
});
