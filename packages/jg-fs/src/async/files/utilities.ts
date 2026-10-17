import { constants, lstat, open, stat, type FileHandle } from 'node:fs/promises';

import { isNoFollowError, isNotFoundError, notARegularFile } from '../../shared/index.js';

/**
 * Reads the permission bits of an existing file.
 * @param path The file's path.
 * @returns A promise that resolves to the bits, or `undefined` when the file doesn't exist.
 */
export const readPermissionBits = async (path: string): Promise<number | undefined> => {
  try {
    return (await stat(path)).mode & 0o777;
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
};

/**
 * Flushes a directory's entries to disk, so a rename inside it survives a crash.
 * @param path The directory's path.
 * @returns A promise that resolves once the directory is flushed.
 */
export const syncDirectory = async (path: string): Promise<void> => {
  const handle = await open(path, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
};

/**
 * Opens a file for reading without following a symbolic link in its last component.
 * @param path The file's path.
 * @returns A promise that resolves to the open file.
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or its final component is a symbolic link
 */
export const openWithoutFollowing = async (path: string): Promise<FileHandle> => {
  try {
    if (process.platform === 'win32') {
      // Windows has no O_NOFOLLOW, so a link swapped in after this check isn't detected
      if ((await lstat(path)).isSymbolicLink()) {
        throw Object.assign(new Error('The path is a symbolic link.'), { code: 'ELOOP' });
      }
      return await open(path, constants.O_RDONLY);
    }
    // O_NONBLOCK keeps a named pipe at the path from blocking the open
    return await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if (isNoFollowError(error)) {
      throw notARegularFile(path, error);
    }
    throw error;
  }
};
