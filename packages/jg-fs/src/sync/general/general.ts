import { accessSync, lstatSync } from 'node:fs';

import { toPathElement, type IPathElement } from '../../shared/index.js';

/**
 * Checks whether a path exists, whether it's a file, a directory, or anything else.
 * @param path The path.
 * @returns Whether the path exists.
 * @example
 * pathExists('config.json'); // true when the file exists
 */
export const pathExists = (path: string): boolean => {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Reads a path's details without following a symbolic link at the path.
 * @param path The path.
 * @returns The path's details, or `null` when it doesn't exist.
 * @example
 * const element = getPathElement('logo.png');
 * element?.size; // the size in bytes, or undefined when the path doesn't exist
 */
export const getPathElement = (path: string): IPathElement | null => {
  try {
    return toPathElement(path, lstatSync(path));
  } catch {
    return null;
  }
};
