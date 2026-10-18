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
} from './database-errors.js';
