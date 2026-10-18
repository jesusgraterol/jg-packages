import { DatabaseError } from 'pg';

/**
 * Checks whether an error is one PostgreSQL returned, with its SQLSTATE code, as node-postgres
 * reports it.
 * @param error The error.
 * @returns Whether it's a node-postgres DatabaseError.
 * @example
 * import { isDatabaseError } from 'jg-postgres';
 *
 * isDatabaseError(new Error('Connection terminated')); // => false
 */
export const isDatabaseError = (error: unknown): error is DatabaseError =>
  error instanceof DatabaseError;

/**
 * Checks a database error's SQLSTATE code, and its constraint when one is given.
 * @param error The error.
 * @param code The SQLSTATE code.
 * @param constraint The constraint's name, when it must match.
 * @returns Whether the error matches.
 */
const matches = (error: unknown, code: string, constraint?: string): error is DatabaseError =>
  isDatabaseError(error) &&
  error.code === code &&
  (constraint === undefined || error.constraint === constraint);

/**
 * Checks whether an error is a unique violation (SQLSTATE 23505), optionally on one constraint.
 * @param error The error.
 * @param constraint The unique constraint's or index's name, when it must match.
 * @returns Whether the error matches.
 * @example
 * import { isUniqueViolationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * if (isUniqueViolationError(error, 'uq_user_account__email')) {
 *   // the email is taken
 * }
 */
export const isUniqueViolationError = (
  error: unknown,
  constraint?: string,
): error is DatabaseError => matches(error, '23505', constraint);

/**
 * Checks whether an error is a foreign key violation (SQLSTATE 23503), optionally on one
 * constraint.
 * @param error The error.
 * @param constraint The foreign key's name, when it must match.
 * @returns Whether the error matches.
 * @example
 * import { isForeignKeyViolationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isForeignKeyViolationError(error, 'fk_order__user_account_id');
 */
export const isForeignKeyViolationError = (
  error: unknown,
  constraint?: string,
): error is DatabaseError => matches(error, '23503', constraint);

/**
 * Checks whether an error is a not-null violation (SQLSTATE 23502).
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isNotNullViolationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isNotNullViolationError(error);
 */
export const isNotNullViolationError = (error: unknown): error is DatabaseError =>
  matches(error, '23502');

/**
 * Checks whether an error is a check violation (SQLSTATE 23514), optionally on one constraint.
 * @param error The error.
 * @param constraint The check constraint's name, when it must match.
 * @returns Whether the error matches.
 * @example
 * import { isCheckViolationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isCheckViolationError(error, 'ck_order__quantity');
 */
export const isCheckViolationError = (
  error: unknown,
  constraint?: string,
): error is DatabaseError => matches(error, '23514', constraint);

/**
 * Checks whether an error is a restrict violation (SQLSTATE 23001), optionally on one constraint.
 * @param error The error.
 * @param constraint The foreign key's name, when it must match.
 * @returns Whether the error matches.
 * @example
 * import { isRestrictViolationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isRestrictViolationError(error);
 */
export const isRestrictViolationError = (
  error: unknown,
  constraint?: string,
): error is DatabaseError => matches(error, '23001', constraint);

/**
 * Checks whether an error is a string data right truncation (SQLSTATE 22001): a value longer than
 * its column allows.
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isStringDataRightTruncationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isStringDataRightTruncationError(error);
 */
export const isStringDataRightTruncationError = (error: unknown): error is DatabaseError =>
  matches(error, '22001');

/**
 * Checks whether an error is a numeric value out of range (SQLSTATE 22003).
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isNumericValueOutOfRangeError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isNumericValueOutOfRangeError(error);
 */
export const isNumericValueOutOfRangeError = (error: unknown): error is DatabaseError =>
  matches(error, '22003');

/**
 * Checks whether an error is an invalid text representation (SQLSTATE 22P02), such as text
 * where a UUID belongs.
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isInvalidTextRepresentationError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isInvalidTextRepresentationError(error);
 */
export const isInvalidTextRepresentationError = (error: unknown): error is DatabaseError =>
  matches(error, '22P02');

/**
 * Checks whether an error is a serialization failure (SQLSTATE 40001), which a retry of the whole
 * transaction may fix.
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isSerializationFailureError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isSerializationFailureError(error);
 */
export const isSerializationFailureError = (error: unknown): error is DatabaseError =>
  matches(error, '40001');

/**
 * Checks whether an error is a detected deadlock (SQLSTATE 40P01), which a retry of the whole
 * transaction may fix.
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isDeadlockDetectedError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isDeadlockDetectedError(error);
 */
export const isDeadlockDetectedError = (error: unknown): error is DatabaseError =>
  matches(error, '40P01');

/**
 * Checks whether an error is a canceled query (SQLSTATE 57014), such as one that ran past
 * statement_timeout.
 * @param error The error.
 * @returns Whether the error matches.
 * @example
 * import { isQueryCanceledError } from 'jg-postgres';
 *
 * declare const error: unknown;
 * isQueryCanceledError(error);
 */
export const isQueryCanceledError = (error: unknown): error is DatabaseError =>
  matches(error, '57014');
