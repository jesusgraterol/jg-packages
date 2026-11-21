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
  writeFileAtomicIfUnchanged,
  writeJsonFile,
  writeTextFile,
} from './files.js';
export { hashFile } from './hash-file.js';
export { installVerifiedFile } from './install-verified-file.js';

// types
export type { IFileHash, IHashFileOptions } from './types.js';

// the no-follow open and the bounded read, shared with private files
export { openWithoutFollowing, readOpenFile } from './utilities.js';
