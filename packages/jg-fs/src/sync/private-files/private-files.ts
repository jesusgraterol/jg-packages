import type { Buffer } from 'node:buffer';
import {
  closeSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  rmSync,
  statSync,
  writeFileSync,
  type Stats,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  directoryNotPrivate,
  fileAlreadyExists,
  fileNotPrivate,
  fileTooLarge,
  hasSharedAccess,
  HAS_POSIX_PERMISSIONS,
  isMissingPathError,
  type IPrivateFileOptions,
  type IReadPrivateFileOptions,
  isNotFoundError,
  isPathWithin,
  listPathAncestry,
  type IWritePrivateFileOptions,
  nonExistentDirectory,
  notADirectory,
  notAFile,
  pathNotCanonical,
  pathOutsideRoot,
  PRIVATE_DIRECTORY_MODE,
  PRIVATE_FILE_MODE,
} from '../../shared/index.js';
import { openWithoutFollowing, readOpenFile, writeFileAtomic } from '../files/index.js';
import { getPathElement } from '../general/index.js';

/**
 * Checks that a path has no symbolic link in it, or, on Windows, a junction, which Node.js reports
 * as one: no part of it, from its first directory down to the path itself, is a link. Each part is
 * checked with lstat, because comparing the path with its real path fails on Windows for a short
 * (8.3) name or another letter case, without any link.
 * @param path The path, which must exist.
 * @param original The path as the caller gave it, for the error.
 * @throws
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 */
const assertCanonical = (path: string, original: string): void => {
  if (listPathAncestry(path).some((part) => lstatSync(part).isSymbolicLink())) {
    throw pathNotCanonical(original);
  }
};

/**
 * Checks that a path is an existing directory with no symbolic link in its path.
 * @param path The directory's path.
 * @param original The path to name when it goes through a symbolic link.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the directory doesn't exist
 * - NOT_A_DIRECTORY: if the path isn't a directory
 * - PATH_NOT_CANONICAL: if the directory goes through a symbolic link
 */
const assertCanonicalDirectory = (path: string, original: string): void => {
  let isDirectory: boolean;
  try {
    isDirectory = statSync(path).isDirectory();
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : error;
  }
  if (!isDirectory) {
    throw notADirectory(path);
  }
  assertCanonical(path, original);
};

/**
 * Checks that a path is strictly inside a root, which must be an existing directory without
 * symbolic links.
 * @param path The path.
 * @param rootPath The root, if any.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the root doesn't exist
 * - NOT_A_DIRECTORY: if the root isn't a directory
 * - PATH_NOT_CANONICAL: if the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the path isn't strictly inside the root
 */
const assertInsideRoot = (path: string, rootPath: string | undefined): void => {
  if (rootPath === undefined) {
    return;
  }
  assertCanonicalDirectory(rootPath, rootPath);
  if (resolve(path) === resolve(rootPath) || !isPathWithin(rootPath, path)) {
    throw pathOutsideRoot(path, rootPath);
  }
};

/**
 * Opens a file and checks, on the open descriptor, that it's private, as the async entry does.
 * @param path The file's path.
 * @param options The root and the size limit.
 * @returns The open descriptor, which the caller closes.
 * @throws
 * - NON_EXISTENT_FILE: if the file doesn't exist
 * - NOT_A_FILE: if the path's final component is a symbolic link, or it isn't a regular file
 * - FILE_NOT_PRIVATE: if other users can access the file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 * - PATH_NOT_CANONICAL: if the path or the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the file isn't strictly inside the root
 * - NON_EXISTENT_DIRECTORY: if the root doesn't exist
 * - NOT_A_DIRECTORY: if the root isn't a directory
 */
const openPrivateFile = (path: string, { rootPath, maxBytes }: IPrivateFileOptions): number => {
  assertInsideRoot(path, rootPath);
  const descriptor = openWithoutFollowing(path);
  try {
    const stats = fstatSync(descriptor);
    if (!stats.isFile()) {
      throw notAFile(path);
    }
    if (HAS_POSIX_PERMISSIONS && hasSharedAccess(stats.mode)) {
      throw fileNotPrivate(path, stats.mode);
    }
    if (maxBytes !== undefined && stats.size > maxBytes) {
      throw fileTooLarge(path, maxBytes);
    }
    assertCanonical(path, path);
    return descriptor;
  } catch (error) {
    closeSync(descriptor);
    throw error;
  }
};

/**
 * Checks that a file is private to its owner, such as a key or a session file before it's trusted:
 * a regular file that isn't a symbolic link, with no symbolic link anywhere in its path, and, on
 * POSIX, without group or other permissions. With `rootPath`, it must be strictly inside that
 * directory; with `maxBytes`, no larger. The checks run on the open file, so a file swapped in
 * between them is caught.
 *
 * On Windows, Node.js reports only a file's read-only attribute as its mode, so the permission
 * check is skipped there: a private file on Windows depends on its directory's access control list.
 * @param path The file's path.
 * @param options The root it must be inside, and the largest size accepted, in bytes.
 * @example
 * import { assertPrivateFile } from 'jg-fs/sync';
 *
 * assertPrivateFile('/home/ada/.config/app/token.json', { rootPath: '/home/ada/.config/app' });
 * @throws
 * - NON_EXISTENT_FILE: if the file doesn't exist
 * - NOT_A_FILE: if the path's final component is a symbolic link, or it isn't a regular file
 * - FILE_NOT_PRIVATE: if other users can access the file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 * - PATH_NOT_CANONICAL: if the path or the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the file isn't strictly inside the root
 * - NON_EXISTENT_DIRECTORY: if the root doesn't exist
 * - NOT_A_DIRECTORY: if the root isn't a directory
 */
export const assertPrivateFile = (path: string, options: IPrivateFileOptions = {}): void => {
  closeSync(openPrivateFile(path, options));
};

/**
 * Reads a file after checking that it's private, as `assertPrivateFile` does, through the same
 * open file, so the content read is the content checked. It reads at most `maxBytes` bytes, even
 * when the file grows while it's read.
 * @param path The file's path.
 * @param options The largest size accepted, in bytes, and the root the file must be inside.
 * @returns The content.
 * @example
 * import { readPrivateFile } from 'jg-fs/sync';
 *
 * const key = readPrivateFile('/home/ada/.ssh/id_ed25519', { maxBytes: 16 * 1024 });
 * @throws
 * - NON_EXISTENT_FILE: if the file doesn't exist
 * - NOT_A_FILE: if the path's final component is a symbolic link, or it isn't a regular file
 * - FILE_NOT_PRIVATE: if other users can access the file
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 * - PATH_NOT_CANONICAL: if the path or the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the file isn't strictly inside the root
 * - NON_EXISTENT_DIRECTORY: if the root doesn't exist
 * - NOT_A_DIRECTORY: if the root isn't a directory
 */
export const readPrivateFile = (
  path: string,
  { maxBytes, rootPath }: IReadPrivateFileOptions,
): Buffer => {
  const descriptor = openPrivateFile(path, { maxBytes, rootPath });
  try {
    return readOpenFile(descriptor, path, maxBytes);
  } finally {
    closeSync(descriptor);
  }
};

/**
 * Creates a file with `0o600` permissions, writes it, and checks it, removing it if any step fails,
 * since this call created it.
 * @param path The file's path.
 * @param data The content.
 * @throws
 * - FILE_ALREADY_EXISTS: if anything already exists at the path, a symbolic link included
 * - FILE_NOT_PRIVATE: if the new file isn't private
 */
const writeExclusive = (path: string, data: string | NodeJS.ArrayBufferView): void => {
  // anything at the path, a dangling symbolic link included, is refused first, because on Windows
  // 'wx' creates a dangling link's target; elsewhere it fails on any existing entry, which also
  // catches one created after this check
  if (getPathElement(path) !== null) {
    throw fileAlreadyExists(path);
  }
  let descriptor: number;
  try {
    descriptor = openSync(path, 'wx', PRIVATE_FILE_MODE);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw fileAlreadyExists(path);
    }
    throw error;
  }
  try {
    writeFileSync(descriptor, data);
    fsyncSync(descriptor);
    const { mode } = fstatSync(descriptor);
    if (HAS_POSIX_PERMISSIONS && hasSharedAccess(mode)) {
      throw fileNotPrivate(path, mode);
    }
  } catch (error) {
    closeSync(descriptor);
    rmSync(path, { force: true });
    throw error;
  }
  closeSync(descriptor);
};

/**
 * Writes a file that only its owner can read and write, such as a token or a session. The file's
 * directory must have no symbolic link in its path, and with `rootPath`, the file must be strictly
 * inside that directory.
 *
 * By default, it replaces the file atomically with `0o600` permissions, through a temporary file
 * that's never more widely readable; a file already at the path must be private, as
 * `assertPrivateFile` checks, so a symbolic link or a shared file is never overwritten. With
 * `isExclusive`, it creates the file and fails when anything is already at the path.
 * @param path The file's path.
 * @param data The content.
 * @param options The root the file must be inside, and whether to create it exclusively.
 * @example
 * import { writePrivateFile } from 'jg-fs/sync';
 *
 * writePrivateFile('/home/ada/.config/app/token.json', '{"token":"…"}');
 * @throws
 * - FILE_ALREADY_EXISTS: if isExclusive is set and anything already exists at the path
 * - NOT_A_FILE: if the path's final component is a symbolic link, or it isn't a regular file
 * - FILE_NOT_PRIVATE: if other users can access the file at the path, or the file written
 * - PATH_NOT_CANONICAL: if the file's directory or the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the file isn't strictly inside the root
 * - NON_EXISTENT_DIRECTORY: if the root or the file's directory doesn't exist
 * - NOT_A_DIRECTORY: if the root or the file's directory isn't a directory
 */
export const writePrivateFile = (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  { rootPath, isExclusive = false }: IWritePrivateFileOptions = {},
): void => {
  assertInsideRoot(path, rootPath);
  assertCanonicalDirectory(dirname(path), path);
  if (isExclusive) {
    writeExclusive(path, data);
    return;
  }
  try {
    lstatSync(path);
    assertPrivateFile(path);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
  writeFileAtomic(path, data, PRIVATE_FILE_MODE);
  const { mode } = statSync(path);
  if (HAS_POSIX_PERMISSIONS && hasSharedAccess(mode)) {
    throw fileNotPrivate(path, mode);
  }
};

/**
 * Checks that a directory is private to its owner: a directory that isn't a symbolic link, with no
 * symbolic link anywhere in its path, and, on POSIX, without group or other permissions. On
 * Windows, the permission check is skipped, as for files.
 * @param path The directory's path.
 * @example
 * import { assertPrivateDirectory } from 'jg-fs/sync';
 *
 * assertPrivateDirectory('/home/ada/.config/app');
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is a symbolic link or isn't a directory
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 * - DIRECTORY_NOT_PRIVATE: if other users can access the directory
 */
export const assertPrivateDirectory = (path: string): void => {
  let stats: Stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : error;
  }
  if (!stats.isDirectory()) {
    throw notADirectory(path);
  }
  assertCanonical(path, path);
  if (HAS_POSIX_PERMISSIONS && hasSharedAccess(stats.mode)) {
    throw directoryNotPrivate(path, stats.mode);
  }
};

/**
 * Creates a directory, and any missing parents, with `0o700` permissions, and checks that it's
 * private, as `assertPrivateDirectory` does. An existing directory that isn't private throws: its
 * permissions are never changed silently.
 * @param path The directory's path.
 * @example
 * import { createPrivateDirectory } from 'jg-fs/sync';
 *
 * createPrivateDirectory('/home/ada/.config/app/sessions');
 * @throws
 * - NOT_A_DIRECTORY: if the path exists and isn't a directory
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 * - DIRECTORY_NOT_PRIVATE: if other users can access the directory
 */
export const createPrivateDirectory = (path: string): void => {
  try {
    mkdirSync(path, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'EEXIST' || error.code === 'ENOTDIR')
    ) {
      throw notADirectory(path);
    }
    throw error;
  }
  assertPrivateDirectory(path);
};
