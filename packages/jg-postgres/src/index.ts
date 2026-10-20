// types
export type {
  ICounterChanges,
  ICounterKey,
  ICounterQuery,
  ICounterTable,
  ICounterTableDefinition,
} from './counters/index.js';
export type { ICursorListingOptions, ICursorPage } from './cursor/index.js';
export type {
  IDatabaseSummary,
  IIntrospectionOptions,
  ITableDiff,
  ITableSize,
} from './introspection/index.js';
export type { ISessionLock, ISessionLockResult } from './locks/index.js';
export type {
  IExpiredRowDeletion,
  IExpiredRowDeletionOptions,
  IRetentionAge,
} from './retention/index.js';
export type {
  IOptionalRead,
  IOptionalReader,
  IOptionalReaderOptions,
} from './optional-reads/index.js';
export type { IPostgres, IPostgresConfig, ITransactionOptions } from './postgres/index.js';
export type { IColumnFilter, IQueryExecutor, IRowId } from './shared/index.js';
export type { IMoveOptions, IOrderedList } from './sorting/index.js';
export type { ITimeoutProfile } from './timeouts/index.js';
export type { IRunTransactionOptions } from './transactions/index.js';
export type { IInitializeSchemaOptions } from './schema-setup/index.js';
export type { IUsageAdmission, IUsageAdmissionInput } from './usage-limits/index.js';
export type {
  IVerificationAttempt,
  IVerificationBinding,
  IVerificationChallenges,
  IVerificationChallengesOptions,
  IVerificationDeliver,
  IVerificationDelivery,
  IVerificationIssue,
  IVerificationPolicy,
  IVerificationResend,
  IVerificationResendRequest,
} from './verification/index.js';

// constants
export { POSTGRES_BIGINT_MAX, POSTGRES_BIGINT_MIN } from './shared/index.js';

// error codes
export { ERRORS } from './shared/index.js';

// pools and transactions
export { createPostgres } from './postgres/index.js';

// database and schema setup
export { ensureDatabase, initializeSchemaOnce } from './schema-setup/index.js';

// transactions on a held client
export { isInTransaction, runTransaction } from './transactions/index.js';

// timeouts
export { defineTimeoutProfile, toPoolTimeouts, withQueryTimeout } from './timeouts/index.js';

// optional reads
export { createOptionalReader } from './optional-reads/index.js';

// retention
export { deleteExpiredInBatches } from './retention/index.js';

// usage limits
export { admitUsage } from './usage-limits/index.js';

// verification challenges
export { createVerificationChallenges } from './verification/index.js';

// introspection
export { diffTables, listTableSizes, readDatabaseSummary } from './introspection/index.js';

// counter tables
export { applyCounterQueries, defineCounterTable } from './counters/index.js';

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
