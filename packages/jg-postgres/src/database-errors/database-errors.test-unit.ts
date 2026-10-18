import { DatabaseError } from 'pg';
import { describe, expect, test } from 'vitest';

import {
  isCheckViolationError,
  isDatabaseError,
  isDeadlockDetectedError,
  isForeignKeyViolationError,
  isInvalidTextRepresentationError,
  isNotNullViolationError,
  isNumericValueOutOfRangeError,
  isQueryCanceledError,
  isRestrictViolationError,
  isSerializationFailureError,
  isStringDataRightTruncationError,
  isUniqueViolationError,
} from './database-errors.js';

/**
 * Builds the error node-postgres reports for a SQLSTATE code.
 * @param code The SQLSTATE code.
 * @param constraint The constraint's name, when the error names one.
 * @returns The error.
 */
const buildDatabaseError = (code: string, constraint?: string): DatabaseError => {
  const error = new DatabaseError('PostgreSQL failed', 0, 'error');
  error.code = code;
  if (constraint !== undefined) {
    error.constraint = constraint;
  }
  return error;
};

// every check with the SQLSTATE code it matches
const CHECKS: ReadonlyArray<readonly [string, string, (error: unknown) => boolean]> = [
  ['restrict violation', '23001', isRestrictViolationError],
  ['string data right truncation', '22001', isStringDataRightTruncationError],
  ['numeric value out of range', '22003', isNumericValueOutOfRangeError],
  ['invalid text representation', '22P02', isInvalidTextRepresentationError],
  ['not-null violation', '23502', isNotNullViolationError],
  ['foreign key violation', '23503', isForeignKeyViolationError],
  ['unique violation', '23505', isUniqueViolationError],
  ['check violation', '23514', isCheckViolationError],
  ['serialization failure', '40001', isSerializationFailureError],
  ['deadlock detected', '40P01', isDeadlockDetectedError],
  ['query canceled', '57014', isQueryCanceledError],
];

describe('isDatabaseError', () => {
  test('accepts node-postgres DatabaseError instances, and nothing else', () => {
    expect(isDatabaseError(buildDatabaseError('23505'))).toBe(true);
    expect(isDatabaseError(new Error('native error'))).toBe(false);
    expect(isDatabaseError(Object.assign(new Error('look-alike'), { code: '23505' }))).toBe(false);
  });
});

describe('SQLSTATE checks', () => {
  test.each(CHECKS)('the %s check accepts %s', (_, code, check) => {
    expect(check(buildDatabaseError(code))).toBe(true);
  });

  test.each(CHECKS)('the %s check rejects another code, and a plain error', (_, code, check) => {
    expect(check(buildDatabaseError('42P01'))).toBe(false);
    expect(check(Object.assign(new Error('look-alike'), { code }))).toBe(false);
  });

  test.each([
    ['unique', '23505', isUniqueViolationError],
    ['foreign key', '23503', isForeignKeyViolationError],
    ['check', '23514', isCheckViolationError],
    ['restrict', '23001', isRestrictViolationError],
  ] as const)('the %s check matches only the named constraint when given one', (_, code, check) => {
    const error = buildDatabaseError(code, 'uq_user_account__email');

    expect(check(error)).toBe(true);
    expect(check(error, 'uq_user_account__email')).toBe(true);
    expect(check(error, 'uq_user_account__phone')).toBe(false);
    expect(check(buildDatabaseError(code), 'uq_user_account__email')).toBe(false);
  });
});
