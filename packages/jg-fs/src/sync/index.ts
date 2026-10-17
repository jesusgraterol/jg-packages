// errors
export { ERRORS } from '../shared/index.js';

// types
export type {
  IDirectoryElementsKeySort,
  IDirectoryElementsOptions,
  IDirectoryPathElements,
  IPathElement,
  IReadJSONFileOptions,
  ISchema,
} from '../shared/index.js';

// general actions
export { isPathWithin } from '../shared/index.js';
export { getPathElement, pathExists } from './general/index.js';

// directory actions
export {
  copyDirectory,
  createDirectory,
  createDirectorySymLink,
  deleteDirectory,
  getDirectoryElements,
  isDirectory,
  readDirectory,
} from './directories/index.js';

// file actions
export {
  copyFile,
  createFileSymLink,
  deleteFile,
  isFile,
  readBoundedFile,
  readBufferFile,
  readFile,
  readJSONFile,
  readTextFile,
  writeBufferFile,
  writeFile,
  writeFileAtomic,
  writeJSONFile,
  writeTextFile,
} from './files/index.js';
