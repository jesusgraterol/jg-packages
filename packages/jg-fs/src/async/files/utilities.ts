import { Buffer } from 'node:buffer';
import { constants, lstat, open, realpath, rename, stat, type FileHandle } from 'node:fs/promises';

import {
  BOUNDED_READ_CHUNK_SIZE,
  fileTooLarge,
  isBusyRenameError,
  isNoFollowError,
  isNotFoundError,
  notARegularFile,
  RENAME_RETRY_DELAYS_MS,
} from '../../shared/index.js';

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
 * Renames a file over another, trying again for about 4 seconds while Windows refuses because
 * another process, such as an antivirus scanner, holds the destination.
 * @param from The file to rename.
 * @param to Its new path.
 * @returns A promise that resolves once it's renamed.
 */
export const renameReplacing = async (from: string, to: string): Promise<void> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const delay = RENAME_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isBusyRenameError(error)) {
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }
  }
};

/**
 * Resolves the file a write replaces: the target of a symbolic link at the path, so the link keeps
 * pointing at the new content, or the path itself when nothing is there yet.
 * @param path The path.
 * @returns A promise that resolves to the path to write.
 */
export const resolveWriteTarget = async (path: string): Promise<string> => {
  try {
    return await realpath(path);
  } catch (error) {
    if (isNotFoundError(error)) {
      return path;
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

/**
 * Reads an open file from its start, at most `maxBytes` bytes, reading at most one byte more to
 * notice a file that grew past the limit while it was read.
 * @param handle The open file.
 * @param path The file's path, for the error.
 * @param maxBytes The largest size accepted, in bytes.
 * @returns A promise that resolves to the content.
 * @throws
 * - FILE_TOO_LARGE: if the file holds more than maxBytes bytes
 */
export const readOpenFile = async (
  handle: FileHandle,
  path: string,
  maxBytes: number,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  while (totalBytes <= maxBytes) {
    const chunk = Buffer.allocUnsafe(Math.min(BOUNDED_READ_CHUNK_SIZE, maxBytes + 1 - totalBytes));
    // each read continues where the previous one ended
    const { bytesRead } = await handle.read(chunk, 0, chunk.length, totalBytes);
    if (bytesRead === 0) {
      break;
    }
    chunks.push(chunk.subarray(0, bytesRead));
    totalBytes += bytesRead;
  }
  if (totalBytes > maxBytes) {
    throw fileTooLarge(path, maxBytes);
  }
  return Buffer.concat(chunks, totalBytes);
};
