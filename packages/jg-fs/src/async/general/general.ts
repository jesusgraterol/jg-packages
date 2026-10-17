import { access, lstat } from 'node:fs/promises';

import { toPathElement, type IPathElement } from '../../shared/index.js';

/**
 * Checks whether a path exists, whether it's a file, a directory, or anything else.
 * @param path The path.
 * @returns A promise that resolves to whether the path exists.
 * @example
 * await pathExists('config.json'); // true when the file exists
 */
export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads a path's details without following a symbolic link at the path.
 * @param path The path.
 * @returns A promise that resolves to the path's details, or `null` when it doesn't exist.
 * @example
 * const element = await getPathElement('logo.png');
 * element?.size; // the size in bytes, or undefined when the path doesn't exist
 */
export const getPathElement = async (path: string): Promise<IPathElement | null> => {
  try {
    return toPathElement(path, await lstat(path));
  } catch {
    return null;
  }
};
