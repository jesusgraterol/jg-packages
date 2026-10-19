import { expectToThrowCode } from 'jg-exception/testing';
import { describe, expect, test } from 'vitest';

import { ERRORS } from '../shared/index.js';

import {
  assertTimeoutProfile,
  buildTransactionTimeoutsQuery,
  defineTimeoutProfile,
  toPoolTimeouts,
  withQueryTimeout,
} from './timeouts.js';
import type { ITimeoutProfile } from './types.js';

describe('defineTimeoutProfile', () => {
  test('adds a 15-second grace to the statement timeout for the client, and freezes the profile', () => {
    const profile = defineTimeoutProfile({ statementTimeoutSeconds: 30, lockTimeoutSeconds: 5 });

    expect(profile).toStrictEqual({
      statementTimeoutSeconds: 30,
      lockTimeoutSeconds: 5,
      queryTimeoutSeconds: 45,
    });
    expect(Object.isFrozen(profile)).toBe(true);
  });

  test('takes a grace of its own, and a lock timeout equal to the statement timeout', () => {
    expect(
      defineTimeoutProfile({
        statementTimeoutSeconds: 0.5,
        lockTimeoutSeconds: 0.5,
        queryGraceSeconds: 0.25,
      }),
    ).toStrictEqual({
      statementTimeoutSeconds: 0.5,
      lockTimeoutSeconds: 0.5,
      queryTimeoutSeconds: 0.75,
    });
  });

  test.each([
    ['a statement timeout of 0', { statementTimeoutSeconds: 0, lockTimeoutSeconds: 0 }],
    ['a negative lock timeout', { statementTimeoutSeconds: 1, lockTimeoutSeconds: -1 }],
    ['an infinite statement timeout', { statementTimeoutSeconds: Infinity, lockTimeoutSeconds: 1 }],
    ['a NaN lock timeout', { statementTimeoutSeconds: 1, lockTimeoutSeconds: Number.NaN }],
    [
      'a lock timeout longer than the statement timeout',
      { statementTimeoutSeconds: 1, lockTimeoutSeconds: 2 },
    ],
    ['a grace of 0', { statementTimeoutSeconds: 1, lockTimeoutSeconds: 1, queryGraceSeconds: 0 }],
    ['a string', { statementTimeoutSeconds: '1', lockTimeoutSeconds: 1 }],
    [
      'a client timeout too large to add up',
      {
        statementTimeoutSeconds: Number.MAX_VALUE,
        lockTimeoutSeconds: 1,
        queryGraceSeconds: Number.MAX_VALUE,
      },
    ],
  ])('throws INVALID_TIMEOUT_PROFILE for %s', (_, options) => {
    expectToThrowCode(
      () => defineTimeoutProfile(options as Parameters<typeof defineTimeoutProfile>[0]),
      ERRORS.INVALID_TIMEOUT_PROFILE,
    );
  });
});

describe('assertTimeoutProfile', () => {
  test.each([[undefined], [null], [{}], [{ statementTimeoutSeconds: 1, lockTimeoutSeconds: 1 }]])(
    'throws INVALID_TIMEOUT_PROFILE for %o, from a caller that skips type checking',
    (profile) => {
      expectToThrowCode(
        () => assertTimeoutProfile(profile as ITimeoutProfile),
        ERRORS.INVALID_TIMEOUT_PROFILE,
      );
    },
  );
});

describe('the timeouts in milliseconds', () => {
  const profile = defineTimeoutProfile({
    statementTimeoutSeconds: 3,
    lockTimeoutSeconds: 0.1,
    queryGraceSeconds: 0.0004,
  });

  test('gives the pool its timeouts, rounded to the millisecond, and at least 1', () => {
    expect(toPoolTimeouts(profile)).toStrictEqual({
      statement_timeout: 3_000,
      lock_timeout: 100,
      query_timeout: 3_000,
    });
    expect(
      toPoolTimeouts(
        defineTimeoutProfile({ statementTimeoutSeconds: 0.0001, lockTimeoutSeconds: 0.0001 }),
      ),
    ).toMatchObject({ statement_timeout: 1, lock_timeout: 1 });
  });

  test('gives a query the client timeout, keeping its values only when it has them', () => {
    expect(withQueryTimeout({ text: 'SELECT 1;' }, profile)).toStrictEqual({
      text: 'SELECT 1;',
      query_timeout: 3_000,
    });
    expect(withQueryTimeout({ text: 'SELECT $1::int;', values: [1] }, profile)).toStrictEqual({
      text: 'SELECT $1::int;',
      values: [1],
      query_timeout: 3_000,
    });
  });

  test('sets the statement and lock timeouts for the transaction only', () => {
    expect(buildTransactionTimeoutsQuery(profile)).toStrictEqual({
      text: "SELECT set_config('statement_timeout', $1, true), set_config('lock_timeout', $2, true);",
      values: ['3000', '100'],
    });
  });

  test('rejects a profile that is not valid', () => {
    const invalid = { statementTimeoutSeconds: 1, lockTimeoutSeconds: 2, queryTimeoutSeconds: 3 };

    expectToThrowCode(() => toPoolTimeouts(invalid), ERRORS.INVALID_TIMEOUT_PROFILE);
    expectToThrowCode(
      () => withQueryTimeout({ text: 'SELECT 1;' }, invalid),
      ERRORS.INVALID_TIMEOUT_PROFILE,
    );
  });
});
