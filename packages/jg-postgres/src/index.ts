// types
export type { ICursorListingOptions, ICursorPage } from './cursor/index.js';
export type { ISessionLock, ISessionLockResult } from './locks/index.js';
export type { IPostgres, IPostgresConfig } from './postgres/index.js';
export type { IColumnFilter, IQueryExecutor, IRowId } from './shared/index.js';
export type { IMoveOptions, IOrderedList } from './sorting/index.js';

// constants
export { POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// pools and transactions
export { createPostgres } from './postgres/index.js';

// SQLSTATE checks
export {
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
} from './database-errors/index.js';

// identifiers
export { quoteIdentifier } from './identifiers/index.js';

// advisory locks
export { createAdvisoryLockKey, lockTransaction, withSessionLock } from './locks/index.js';

// cursor pages
export { buildCursorPage, listByCursor } from './cursor/index.js';

// ordered lists
export { lockOrderedList, moveDown, moveUp } from './sorting/index.js';
