import { access, lstat } from 'node:fs/promises';

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
 * @returns A promise that resolves to whether the path exists.
 * @example
 * import { pathExists } from 'jg-fs';
 *
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
 * import { getPathElement } from 'jg-fs';
 *
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

/**
 * Checks that no directory between a root and a path is a symbolic link, or, on Windows, a
 * junction, such as before writing a file inside a repository that someone else may have changed.
 * It reads each directory strictly below the root, down to the path's parent, without following
 * it, and stops at the first that doesn't exist, which a write would create. The root itself and
 * the path's last component aren't checked.
 * @param rootPath The root, such as a repository's working tree.
 * @param path The path, strictly inside the root.
 * @returns A promise that resolves once the directories are checked.
 * @example
 * import { assertNoLinksBelow, writeFileAtomic } from 'jg-fs';
 *
 * await assertNoLinksBelow('/srv/repo', '/srv/repo/docs/guides/install.md');
 * await writeFileAtomic('/srv/repo/docs/guides/install.md', '# Install\n');
 * @throws
 * - PATH_OUTSIDE_ROOT: if the path isn't strictly inside the root
 * - PATH_NOT_CANONICAL: if a directory on the way is a symbolic link or a junction
 * - NOT_A_DIRECTORY: if a component on the way is a file
 */
export const assertNoLinksBelow = async (rootPath: string, path: string): Promise<void> => {
  for (const directory of listDirectoriesBelow(rootPath, path)) {
    let stats;
    try {
      stats = await lstat(directory);
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
