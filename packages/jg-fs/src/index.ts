// errors
export { ERRORS } from './shared/index.js';

// types
export type {
  IDirectoryElementsKeySort,
  IDirectoryElementsOptions,
  IDirectoryPathElements,
  IFileLockOwner,
  IPathElement,
  IPrivateFileOptions,
  IReadJsonFileOptions,
  IReadPrivateFileOptions,
  ISchema,
  IWritePrivateFileOptions,
} from './shared/index.js';

// general actions
export { isPathWithin } from './shared/index.js';
export { getPathElement, pathExists } from './async/general/index.js';

// directory actions
export {
  copyDirectory,
  createDirectory,
  createDirectorySymLink,
  deleteDirectory,
  getDirectoryElements,
  isDirectory,
  readDirectory,
} from './async/directories/index.js';

// file actions
export {
  copyFile,
  createFileSymLink,
  deleteFile,
  isFile,
  readBoundedFile,
  readBufferFile,
  readFile,
  readJsonFile,
  readTextFile,
  writeBufferFile,
  writeFile,
  writeFileAtomic,
  writeJsonFile,
  writeTextFile,
} from './async/files/index.js';

// private file actions
export {
  assertPrivateDirectory,
  assertPrivateFile,
  createPrivateDirectory,
  readPrivateFile,
  writePrivateFile,
} from './async/private-files/index.js';

// lock actions
export { type IFileLock, acquireLock } from './async/locks/index.js';
