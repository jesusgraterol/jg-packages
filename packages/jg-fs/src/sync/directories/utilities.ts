import { lstatSync, type Stats } from 'node:fs';

import { isMissingPathError, nonExistentDirectory, notADirectory } from '../../shared/index.js';

/**
 * Ensures a path is an existing directory, without following a symbolic link at the path.
 * @param path The path.
 * @throws
 * - NON_EXISTENT_DIRECTORY: if the path doesn't exist
 * - NOT_A_DIRECTORY: if the path is not a directory
 */
export const assertExistingDirectory = (path: string): void => {
  let stats: Stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    throw isMissingPathError(error) ? nonExistentDirectory(path, error) : notADirectory(path);
  }
  if (!stats.isDirectory()) {
    throw notADirectory(path);
  }
};
