import { accessSync, lstatSync, type Stats } from 'node:fs';

import {
  isMissingPathError,
  listDirectoriesBelow,
  notADirectory,
  pathNotCanonical,
  toPathElement,
  type IPathElement,
} from '../../shared/index.js';

/**
 * Checks whether a path exists, whether it's a file, a directory, or anything else.
 * @param path The path.
 * @returns Whether the path exists.
 * @example
 * import { pathExists } from 'jg-fs/sync';
 *
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
 * import { getPathElement } from 'jg-fs/sync';
 *
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

/**
 * Checks that no directory between a root and a path is a symbolic link, or, on Windows, a
 * junction, such as before writing a file inside a repository that someone else may have changed.
 * It reads each directory strictly below the root, down to the path's parent, without following
 * it, and stops at the first that doesn't exist, which a write would create. The root itself and
 * the path's last component aren't checked.
 * @param rootPath The root, such as a repository's working tree.
 * @param path The path, strictly inside the root.
 * @example
 * import { assertNoLinksBelow, writeFileAtomic } from 'jg-fs/sync';
 *
 * assertNoLinksBelow('/srv/repo', '/srv/repo/docs/guides/install.md');
 * writeFileAtomic('/srv/repo/docs/guides/install.md', '# Install\n');
 * @throws
 * - PATH_OUTSIDE_ROOT: if the path isn't strictly inside the root
 * - PATH_NOT_CANONICAL: if a directory on the way is a symbolic link or a junction
 * - NOT_A_DIRECTORY: if a component on the way is a file
 */
export const assertNoLinksBelow = (rootPath: string, path: string): void => {
  for (const directory of listDirectoriesBelow(rootPath, path)) {
    let stats: Stats;
    try {
      stats = lstatSync(directory);
    } catch (error) {
      if (isMissingPathError(error)) {
        return;
      }
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw pathNotCanonical(directory);
    }
    if (!stats.isDirectory()) {
      throw notADirectory(directory);
    }
  }
};
