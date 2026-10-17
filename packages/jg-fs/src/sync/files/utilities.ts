import { closeSync, constants, fsyncSync, lstatSync, openSync, statSync } from 'node:fs';

import { isNoFollowError, isNotFoundError, notARegularFile } from '../../shared/index.js';

/**
 * Reads the permission bits of an existing file.
 * @param path The file's path.
 * @returns The bits, or `undefined` when the file doesn't exist.
 */
export const readPermissionBits = (path: string): number | undefined => {
  try {
    return statSync(path).mode & 0o777;
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
 */
export const syncDirectory = (path: string): void => {
  const descriptor = openSync(path, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

/**
 * Opens a file for reading without following a symbolic link in its last component.
 * @param path The file's path.
 * @returns The file descriptor.
 * @throws
 * - NOT_A_FILE: if the path doesn't exist or its final component is a symbolic link
 */
export const openWithoutFollowing = (path: string): number => {
  try {
    if (process.platform === 'win32') {
      // Windows has no O_NOFOLLOW, so a link swapped in after this check isn't detected
      if (lstatSync(path).isSymbolicLink()) {
        throw Object.assign(new Error('The path is a symbolic link.'), { code: 'ELOOP' });
      }
      return openSync(path, constants.O_RDONLY);
    }
    // O_NONBLOCK keeps a named pipe at the path from blocking the open
    return openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  } catch (error) {
    if (isNoFollowError(error)) {
      throw notARegularFile(path, error);
    }
    throw error;
  }
};
