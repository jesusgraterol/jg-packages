// errors
export { ERRORS } from './errors.js';

// types
export type {
  IDirectoryElementsKeySort,
  IDirectoryElementsOptions,
  IDirectoryPathElements,
  IPathElement,
  IReadBufferFileOptions,
  IReadFileOptions,
  IReadJsonFileOptions,
  IReadStringFileOptions,
  ISchema,
} from './types.js';

// constants
export {
  BOUNDED_READ_CHUNK_SIZE,
  DIRECTORY_ELEMENTS_CONCURRENCY,
  DIRECTORY_ELEMENTS_DEFAULT_OPTIONS,
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
  isNoFollowError,
  isNotFoundError,
  notADirectory,
  notAFile,
  notARegularFile,
  parseJsonContent,
  serializeJsonData,
} from './validations.js';
