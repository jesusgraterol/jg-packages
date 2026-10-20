// errors
export { ERRORS } from './errors.js';

// types
export type {
  IDirectoryElementsKeySort,
  IDirectoryElementsOptions,
  IDirectoryPathElements,
  IFileLockOwner,
  ILockBusyReason,
  ILockJudgement,
  IPathElement,
  IPrivateFileOptions,
  IReadBufferFileOptions,
  IReadFileOptions,
  IReadJsonFileOptions,
  IReadPrivateFileOptions,
  IReadStringFileOptions,
  ISchema,
  IWritePrivateFileOptions,
} from './types.js';

// constants
export {
  BOUNDED_READ_CHUNK_SIZE,
  DIRECTORY_ELEMENTS_CONCURRENCY,
  DIRECTORY_ELEMENTS_DEFAULT_OPTIONS,
  RENAME_RETRY_DELAYS_MS,
} from './constants.js';

// paths
export { isPathWithin, toPathElement } from './paths.js';

// directory elements
export { buildDirectoryElementsOptions, groupDirectoryElements } from './directory-elements.js';

// validations and exceptions
export {
  assertBufferData,
  assertTextData,
  fileTooLarge,
  isBusyRenameError,
  isMissingPathError,
  isNoFollowError,
  isNotFoundError,
  nonExistentDirectory,
  nonExistentFile,
  notADirectory,
  notAFile,
  notARegularFile,
  parseJsonContent,
  serializeJsonData,
} from './validations.js';

// private files
export {
  directoryNotPrivate,
  fileAlreadyExists,
  fileNotPrivate,
  hasSharedAccess,
  HAS_POSIX_PERMISSIONS,
  pathNotCanonical,
  pathOutsideRoot,
  PRIVATE_DIRECTORY_MODE,
  PRIVATE_FILE_MODE,
} from './private-files.js';

// locks
export {
  createLockOwner,
  judgeExistingLock,
  lockAcquisitionFailed,
  lockBusy,
  lockNotOwned,
  lockReleaseFailed,
  LOCK_OWNER_FILE,
  LOCK_OWNER_MAX_BYTES,
  LOCK_RECOVERY_DIRECTORY,
  isProcessGone,
  isSameLockOwner,
  parseLockOwner,
  serializeLockOwner,
} from './locks.js';
