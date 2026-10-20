import type { Buffer } from 'node:buffer';
import type { Stats } from 'node:fs';
import { lstat, mkdir, open, realpath, rm, stat, type FileHandle } from 'node:fs/promises';
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

/**
 * Checks that a path has no symbolic link in it: its real path is the path itself.
 * @param path The path, which must exist.
 * @param original The path as the caller gave it, for the error.
 * @returns A promise that resolves once the path is checked.
 * @throws
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 */
const assertCanonical = async (path: string, original: string): Promise<void> => {
  if ((await realpath(path)) !== resolve(path)) {
    throw pathNotCanonical(original);
  }
};

/**
 * Checks that a path is an existing directory with no symbolic link in its path.
 * @param path The directory's path.
 * @param original The path to name when it goes through a symbolic link.
 * @returns A promise that resolves once the directory is checked.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the directory doesn't exist
 * - NOT_A_DIRECTORY: if the path isn't a directory
 * - PATH_NOT_CANONICAL: if the directory goes through a symbolic link
 */
const assertCanonicalDirectory = async (path: string, original: string): Promise<void> => {
  let isDirectory: boolean;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : error;
  }
  if (!isDirectory) {
    throw notADirectory(path);
  }
  await assertCanonical(path, original);
};

/**
 * Checks that a path is strictly inside a root, which must be an existing directory without
 * symbolic links.
 * @param path The path.
 * @param rootPath The root, if any.
 * @returns A promise that resolves once the path is checked.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the root doesn't exist
 * - NOT_A_DIRECTORY: if the root isn't a directory
 * - PATH_NOT_CANONICAL: if the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the path isn't strictly inside the root
 */
const assertInsideRoot = async (path: string, rootPath: string | undefined): Promise<void> => {
  if (rootPath === undefined) {
    return;
  }
  await assertCanonicalDirectory(rootPath, rootPath);
  if (resolve(path) === resolve(rootPath) || !isPathWithin(rootPath, path)) {
    throw pathOutsideRoot(path, rootPath);
  }
};

/**
 * Opens a file and checks, on the open handle, that it's private: a regular file, not a symbolic
 * link, without group or other permissions on POSIX, within the size limit, with no symbolic link
 * in its path, and inside its root.
 * @param path The file's path.
 * @param options The root and the size limit.
 * @returns A promise that resolves to the open file, which the caller closes.
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
const openPrivateFile = async (
  path: string,
  { rootPath, maxBytes }: IPrivateFileOptions,
): Promise<FileHandle> => {
  await assertInsideRoot(path, rootPath);
  const handle = await openWithoutFollowing(path);
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) {
      throw notAFile(path);
    }
    if (HAS_POSIX_PERMISSIONS && hasSharedAccess(stats.mode)) {
      throw fileNotPrivate(path, stats.mode);
    }
    if (maxBytes !== undefined && stats.size > maxBytes) {
      throw fileTooLarge(path, maxBytes);
    }
    await assertCanonical(path, path);
    return handle;
  } catch (error) {
    await handle.close();
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
 * @returns A promise that resolves once the file passes every check.
 * @example
 * import { assertPrivateFile } from 'jg-fs';
 *
 * await assertPrivateFile('/home/ada/.config/app/token.json', { rootPath: '/home/ada/.config/app' });
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
export const assertPrivateFile = async (
  path: string,
  options: IPrivateFileOptions = {},
): Promise<void> => {
  const handle = await openPrivateFile(path, options);
  await handle.close();
};

/**
 * Reads a file after checking that it's private, as `assertPrivateFile` does, through the same
 * open file, so the content read is the content checked. It reads at most `maxBytes` bytes, even
 * when the file grows while it's read.
 * @param path The file's path.
 * @param options The largest size accepted, in bytes, and the root the file must be inside.
 * @returns A promise that resolves to the content.
 * @example
 * import { readPrivateFile } from 'jg-fs';
 *
 * const key = await readPrivateFile('/home/ada/.ssh/id_ed25519', { maxBytes: 16 * 1024 });
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
export const readPrivateFile = async (
  path: string,
  { maxBytes, rootPath }: IReadPrivateFileOptions,
): Promise<Buffer> => {
  const handle = await openPrivateFile(path, { maxBytes, rootPath });
  try {
    return await readOpenFile(handle, path, maxBytes);
  } finally {
    await handle.close();
  }
};

/**
 * Creates a file with `0o600` permissions, writes it, and checks it, removing it if any step fails,
 * since this call created it.
 * @param path The file's path.
 * @param data The content.
 * @returns A promise that resolves once the file is written and flushed.
 * @throws
 * - FILE_ALREADY_EXISTS: if anything already exists at the path, a symbolic link included
 * - FILE_NOT_PRIVATE: if the new file isn't private
 */
const writeExclusive = async (
  path: string,
  data: string | NodeJS.ArrayBufferView,
): Promise<void> => {
  let handle: FileHandle;
  try {
    // 'wx' fails on any existing entry, even a dangling symbolic link
    handle = await open(path, 'wx', PRIVATE_FILE_MODE);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw fileAlreadyExists(path);
    }
    throw error;
  }
  try {
    await handle.writeFile(data);
    await handle.sync();
    const { mode } = await handle.stat();
    if (HAS_POSIX_PERMISSIONS && hasSharedAccess(mode)) {
      throw fileNotPrivate(path, mode);
    }
  } catch (error) {
    await handle.close();
    await rm(path, { force: true });
    throw error;
  }
  await handle.close();
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
 * @returns A promise that resolves once the file is written.
 * @example
 * import { writePrivateFile } from 'jg-fs';
 *
 * await writePrivateFile('/home/ada/.config/app/token.json', '{"token":"…"}');
 * @throws
 * - FILE_ALREADY_EXISTS: if isExclusive is set and anything already exists at the path
 * - NOT_A_FILE: if the path's final component is a symbolic link, or it isn't a regular file
 * - FILE_NOT_PRIVATE: if other users can access the file at the path, or the file written
 * - PATH_NOT_CANONICAL: if the file's directory or the root goes through a symbolic link
 * - PATH_OUTSIDE_ROOT: if the file isn't strictly inside the root
 * - NON_EXISTENT_DIRECTORY: if the root or the file's directory doesn't exist
 * - NOT_A_DIRECTORY: if the root or the file's directory isn't a directory
 */
export const writePrivateFile = async (
  path: string,
  data: string | NodeJS.ArrayBufferView,
  { rootPath, isExclusive = false }: IWritePrivateFileOptions = {},
): Promise<void> => {
  await assertInsideRoot(path, rootPath);
  await assertCanonicalDirectory(dirname(path), path);
  if (isExclusive) {
    await writeExclusive(path, data);
    return;
  }
  try {
    await lstat(path);
    await assertPrivateFile(path);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
  await writeFileAtomic(path, data, PRIVATE_FILE_MODE);
  const { mode } = await stat(path);
  if (HAS_POSIX_PERMISSIONS && hasSharedAccess(mode)) {
    throw fileNotPrivate(path, mode);
  }
};

/**
 * Checks that a directory is private to its owner: a directory that isn't a symbolic link, with no
 * symbolic link anywhere in its path, and, on POSIX, without group or other permissions. On
 * Windows, the permission check is skipped, as for files.
 * @param path The directory's path.
 * @returns A promise that resolves once the directory passes every check.
 * @example
 * import { assertPrivateDirectory } from 'jg-fs';
 *
 * await assertPrivateDirectory('/home/ada/.config/app');
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is a symbolic link or isn't a directory
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 * - DIRECTORY_NOT_PRIVATE: if other users can access the directory
 */
export const assertPrivateDirectory = async (path: string): Promise<void> => {
  let stats: Stats;
  try {
    stats = await lstat(path);
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : error;
  }
  if (!stats.isDirectory()) {
    throw notADirectory(path);
  }
  await assertCanonical(path, path);
  if (HAS_POSIX_PERMISSIONS && hasSharedAccess(stats.mode)) {
    throw directoryNotPrivate(path, stats.mode);
  }
};

/**
 * Creates a directory, and any missing parents, with `0o700` permissions, and checks that it's
 * private, as `assertPrivateDirectory` does. An existing directory that isn't private throws: its
 * permissions are never changed silently.
 * @param path The directory's path.
 * @returns A promise that resolves once the directory exists and is private.
 * @example
 * import { createPrivateDirectory } from 'jg-fs';
 *
 * await createPrivateDirectory('/home/ada/.config/app/sessions');
 * @throws
 * - NOT_A_DIRECTORY: if the path exists and isn't a directory
 * - PATH_NOT_CANONICAL: if the path goes through a symbolic link
 * - DIRECTORY_NOT_PRIVATE: if other users can access the directory
 */
export const createPrivateDirectory = async (path: string): Promise<void> => {
  try {
    await mkdir(path, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
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
  await assertPrivateDirectory(path);
};
